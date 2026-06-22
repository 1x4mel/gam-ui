#!/usr/bin/env python3
"""Write gam/api.py (the 7 whitelisted methods for gam-ui).

⚠️  STALE / DESTRUCTIVE — DO NOT RUN.
`main()` OVERWRITES api.py with the `API` string below, but that string only
covers the original 7 whitelisted methods (+ get_role_audit). The live
~/frappe-bench/apps/gam/gam/api.py has since grown to ~1800 lines and now also
contains save_account, delete_account, get_list_options, add_account_game and
the Cloudflare Email Routing setup — NONE of which are reproduced here.

Running this script would TRUNCATE api.py and delete all of that code.
The live file is the source of truth; edit it directly. This generator is kept
only for archaeological reference until it is regenerated from the live file.
"""
import os

PATH = os.path.expanduser("~/frappe-bench/apps/gam/gam/api.py")

API = r'''# Copyright (c) 2026, GAM and contributors
# License: MIT
"""GAM whitelisted API surface consumed by the gam-ui SPA.

Contracts (must match gam-ui/src/composables/* and views/*):
  reveal_password(doctype, name, fieldname, action)        -> {password}
  request_code(email_name, account_name, platform)         -> {status, code, platform, expires_at} | {status:"no_code"}
  checkout_account(account, purpose, lease_minutes, ...)    -> usage doc
  checkin_account(account, end_reason, notes)              -> usage doc
  get_dashboard_stats()                                    -> stats dict
  global_search(query)                                     -> {accounts, emails, games}
  receive_email_webhook()                                  -> allow_guest, X-Webhook-Secret
"""
import re
from email.utils import parsedate_to_datetime

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import (
	add_to_date,
	cint,
	convert_utc_to_system_timezone,
	now_datetime,
)

from gam.realtime import emit_new_code

# Password fields that may be revealed. Design §4.4/§6.2.
REVEALABLE_FIELDS = {"account_password", "email_password", "totp_secret"}

# GAM Account.platform -> code platform (matches gam-ui AccountDetailView.codePlatform).
PLATFORM_TO_CODE_PLATFORM = {
	"STEAM": "STEAM",
	"BATTLENET": "BATTLENET",
	"STANDALONE": "POE",
}


# ============================================================================
# 1. Reveal password (audit-logged)
# ============================================================================
@frappe.whitelist()
@rate_limit(limit=20, seconds=60)
def reveal_password(doctype, name, fieldname, action="REVEAL"):
	if fieldname not in REVEALABLE_FIELDS:
		frappe.throw(_("Reveal not allowed for field {0}").format(fieldname))

	# frappe.get_doc enforces read permission by role
	doc = frappe.get_doc(doctype, name)
	password = doc.get_password(fieldname) or ""

	_log_reveal(doctype, name, fieldname, action)
	return {"password": password}


def _log_reveal(doctype, name, fieldname, action):
	request = getattr(frappe.local, "request", None)
	ip = ""
	user_agent = ""
	if request is not None:
		ip = request.headers.get("X-Forwarded-For") or request.remote_addr or ""
		user_agent = (request.headers.get("User-Agent") or "")[:1400]

	frappe.get_doc(
		{
			"doctype": "GAM Reveal Log",
			"action": action,
			"viewed_by": frappe.session.user,
			"target_doctype": doctype,
			"target_name": name,
			"fieldname": fieldname,
			"ip_address": (ip or "").split(",")[0].strip()[:140],
			"user_agent": user_agent,
			"viewed_at": now_datetime(),
		}
	).insert(ignore_permissions=True)


# ============================================================================
# 2. Request verification code (atomic claim)
# ============================================================================
@frappe.whitelist()
@rate_limit(limit=30, seconds=60)
def request_code(email_name=None, account_name=None, platform=None):

	target_email, target_account, resolved_platform = _resolve_request_target(
		email_name, account_name, platform
	)

	now = now_datetime()
	claimed = _claim_latest_code(target_email, resolved_platform, now)

	if claimed:
		status = "FULFILLED"
		_log_code_request(
			target_email=target_email,
			target_account=target_account,
			platform=claimed["platform"],
			code_value=claimed["code"],
			status=status,
			email_code=claimed["name"],
		)
		return {
			"status": "ok",
			"code": claimed["code"],
			"platform": claimed["platform"],
			"expires_at": claimed["expires_at"],
		}

	_log_code_request(
		target_email=target_email,
		target_account=target_account,
		platform=resolved_platform,
		code_value="",
		status="NO_CODE",
		email_code=None,
	)
	return {"status": "no_code"}


def _resolve_request_target(email_name, account_name, platform):
	target_email = email_name
	target_account = account_name or None
	resolved_platform = platform

	if account_name:
		acc = frappe.db.get_value(
			"GAM Account", account_name, ["email", "platform"], as_dict=True
		)
		if not acc:
			frappe.throw(_("Account {0} not found").format(account_name))
		target_email = acc.email
		if not resolved_platform and acc.platform:
			resolved_platform = PLATFORM_TO_CODE_PLATFORM.get(acc.platform)

	if not target_email:
		frappe.throw(_("Could not resolve a target email for this request."))

	return target_email, target_account, resolved_platform


def _claim_latest_code(target_email, platform, now):
	"""Atomically claim the freshest AVAILABLE code with SELECT ... FOR UPDATE."""
	platform_clause = " AND platform = %(platform)s" if platform else ""
	row = frappe.db.sql(
		f"""
		SELECT name
		FROM `tabGAM Email Code`
		WHERE status = 'AVAILABLE'
		  AND expires_at > %(now)s
		  AND email = %(email)s
		  {platform_clause}
		ORDER BY received_at DESC
		LIMIT 1
		FOR UPDATE
		""",
		{"now": now, "email": target_email, "platform": platform},
		as_dict=True,
	)
	if not row:
		return None

	code_doc = frappe.get_doc("GAM Email Code", row[0].name)
	code_doc.status = "CLAIMED"
	code_doc.claimed_by = frappe.session.user
	code_doc.claimed_at = now
	code_doc.save(ignore_permissions=True)

	return {
		"name": code_doc.name,
		"code": code_doc.code,
		"platform": code_doc.platform,
		"expires_at": code_doc.expires_at,
	}


def _log_code_request(target_email, target_account, platform, code_value, status, email_code):
	frappe.get_doc(
		{
			"doctype": "GAM Code Request Log",
			"requested_by": frappe.session.user,
			"email_code": email_code,
			"target_email": target_email,
			"target_account": target_account,
			"platform": platform or "",
			"code_value": code_value or "",
			"status": status,
			"requested_at": now_datetime(),
		}
	).insert(ignore_permissions=True)


# ============================================================================
# 3. Checkout / check-in account leases
# ============================================================================
@frappe.whitelist()
def checkout_account(account, purpose="LOGIN", lease_minutes=120, order_ref=None, notes=None):
	# read permission on the account is enforced here
	frappe.get_doc("GAM Account", account)

	now = now_datetime()
	# auto-release any expired lease first
	_auto_release_expired(account, now)

	active = frappe.db.get_value(
		"GAM Account Usage",
		{"account": account, "status": "IN_USE"},
		["name", "used_by"],
		as_dict=True,
	)
	if active:
		if active.used_by != frappe.session.user:
			frappe.throw(_("Account is already checked out by another user."))
		# same user re-checkout: return the existing lease
		return frappe.get_doc("GAM Account Usage", active.name).as_dict()

	usage = frappe.get_doc(
		{
			"doctype": "GAM Account Usage",
			"account": account,
			"status": "IN_USE",
			"used_by": frappe.session.user,
			"purpose": purpose,
			"order_ref": order_ref or "",
			"started_at": now,
			"lease_until": add_to_date(now, minutes=cint(lease_minutes) or 120),
			"notes": notes or "",
		}
	)
	usage.insert(ignore_permissions=True)
	return usage.as_dict()


@frappe.whitelist()
def checkin_account(account, end_reason="DONE", notes=None):
	active = frappe.db.get_value(
		"GAM Account Usage",
		{"account": account, "status": "IN_USE"},
		["name", "used_by"],
		as_dict=True,
	)
	if not active:
		frappe.throw(_("This account is not currently checked out."))

	usage = frappe.get_doc("GAM Account Usage", active.name)
	usage.status = "RELEASED"
	usage.ended_at = now_datetime()
	usage.end_reason = end_reason
	if notes:
		usage.notes = notes
	usage.save(ignore_permissions=True)
	return usage.as_dict()


def _auto_release_expired(account, now):
	names = frappe.get_all(
		"GAM Account Usage",
		filters={"account": account, "status": "IN_USE", "lease_until": ["<", now]},
		pluck="name",
	)
	for name in names:
		usage = frappe.get_doc("GAM Account Usage", name)
		usage.status = "FORCE_RELEASED"
		usage.ended_at = now
		usage.end_reason = "TIMEOUT"
		usage.save(ignore_permissions=True)


# ============================================================================
# 4. Dashboard stats
# ============================================================================
@frappe.whitelist()
def get_dashboard_stats():
	now = now_datetime()
	week_ahead = add_to_date(now, days=7)

	total_accounts = frappe.db.count("GAM Account")
	banned_accounts = frappe.db.count("GAM Account", {"status": "BANNED"})
	total_emails = frappe.db.count("GAM Email", {"is_active": 1})
	available_codes = frappe.db.count(
		"GAM Email Code", {"status": "AVAILABLE", "expires_at": [">", now]}
	)

	expiring = frappe.get_all(
		"GAM Account Link",
		filters={"status": "ACTIVE", "expiry_date": ["between", [now, week_ahead]]},
		fields=["name", "source_account", "target_account", "link_type", "expiry_date"],
		order_by="expiry_date asc",
		limit_page_length=20,
	)
	for link in expiring:
		link["days_left"] = max(
			0, int((link["expiry_date"] - now).total_seconds() // 86400) if link.get("expiry_date") else 0
		)

	return {
		"total_accounts": total_accounts,
		"banned_accounts": banned_accounts,
		"total_emails": total_emails,
		"available_codes": available_codes,
		"expiring_links_count": len(expiring),
		"expiring_links": expiring,
	}


@frappe.whitelist()
def get_games_by_role():
	"""Distinct games per Account Role with live account counts (aggregate only).

	Returns: { "<ROLE_VALUE>": [ {game, game_name, count}, ... ], ... }
	Only roles/games with >=1 account are included. Aggregate-only (counts +
	names) so it is safe to expose to any GAM user.
	"""
	rows = frappe.db.sql(
		"""
		SELECT a.role AS role,
		       g.game AS game,
		       gg.game_name AS game_name,
		       COUNT(DISTINCT a.name) AS count
		FROM `tabGAM Account` a
		INNER JOIN `tabGAM Account Game` g
		  ON g.parent = a.name AND g.parenttype = 'GAM Account'
		LEFT JOIN `tabGAM Game` gg ON gg.name = g.game
		WHERE IFNULL(a.role, '') != ''
		GROUP BY a.role, g.game, gg.game_name
		ORDER BY a.role, gg.game_name
		""",
		as_dict=True,
	)
	out = {}
	for r in rows:
		out.setdefault(r["role"], []).append(
			{
				"game": r["game"],
				"game_name": r["game_name"] or r["game"],
				"count": cint(r["count"]),
			}
		)
	return out



@frappe.whitelist()
def get_account_names_for_game(game):
	"""GAM Account names that own a given game.

	Used by the Accounts view game filter. Raw SQL over the
	``tabGAM Account Game`` child table — child doctypes have no ``select``
	permission, so the permission-checked REST ``get_list`` returns nothing
	for non-System-Manager users. Account names are already visible to GAM
	users via the account list, so this is safe to expose.
	"""
	game = (game or "").strip()
	if not game:
		return []
	rows = frappe.db.sql(
		"""
		SELECT DISTINCT g.parent AS name
		FROM `tabGAM Account Game` g
		WHERE g.parenttype = 'GAM Account' AND g.game = %s
		""",
		(game,),
		as_dict=False,
	)
	return [r[0] for r in rows] if rows else []


# ============================================================================
# 5. Global search
# ============================================================================
@frappe.whitelist()
def global_search(query):
	q = (query or "").strip()
	if len(q) < 2:
		return {"accounts": [], "emails": [], "games": []}
	like = f"%{q}%"

	accounts = frappe.get_all(
		"GAM Account",
		filters=[["username", "like", like]],
		fields=["name", "platform", "username", "email", "status"],
		limit_page_length=10,
	)
	# resolve email link -> address for nicer display
	email_names = list({a["email"] for a in accounts if a.get("email")})
	email_map = {}
	if email_names:
		for em in frappe.get_all(
			"GAM Email", filters=[["name", "in", email_names]], fields=["name", "address"]
		):
			email_map[em.name] = em.address
	for a in accounts:
		a["email"] = email_map.get(a.get("email"), a.get("email"))

	emails = frappe.get_all(
		"GAM Email",
		filters=[["address", "like", like]],
		fields=["name", "address", "provider"],
		limit_page_length=10,
	)
	games = frappe.get_all(
		"GAM Game",
		filters=[["game_name", "like", like]],
		fields=["name", "game_name", "publisher"],
		limit_page_length=10,
	)

	return {"accounts": accounts, "emails": emails, "games": games}


# ============================================================================
# 6. Receive email webhook (Cloudflare Email Worker)
# ============================================================================
@frappe.whitelist(allow_guest=True)
def receive_email_webhook():
	"""Inbound endpoint for the Cloudflare Email Worker.

	The Worker POSTs JSON: { email_account, from, subject, body, html,
	message_id, received_at, raw }. Authenticated via X-Webhook-Secret.
	"""
	_verify_webhook_secret()
	data = _webhook_payload()

	email_account = (data.get("email_account") or "").strip().lower()
	sender = (data.get("from") or data.get("sender") or "").strip()
	subject = data.get("subject") or ""
	body = data.get("body") or data.get("text") or data.get("html") or ""
	message_id = data.get("message_id") or ""
	raw = (data.get("raw") or "")[:5000]
	received_at = _parse_received_at(data.get("received_at")) or now_datetime()

	inbound = frappe.new_doc("GAM Email Inbound Log")
	inbound.email_account = email_account
	inbound.email_from = sender[:140]
	inbound.email_subject = subject[:140]
	inbound.message_id = message_id[:140]
	inbound.received_at = received_at
	inbound.fetched_at = now_datetime()
	inbound.raw_snippet = raw

	if email_account:
		inbound.gam_email = frappe.db.get_value("GAM Email", {"address": email_account})

	# de-dup by message id
	if message_id and frappe.db.exists("GAM Email Inbound Log", {"message_id": message_id}):
		inbound.status = "DUPLICATE"
		inbound.insert(ignore_permissions=True)
		_update_webhook_status("OK")
		return {"status": "duplicate"}

	pattern = _match_pattern(sender, subject, body)
	if not pattern:
		inbound.status = "NO_MATCH"
		inbound.insert(ignore_permissions=True)
		_update_webhook_status("OK")
		return {"status": "no_match"}

	code = pattern["extracted"]
	ttl = cint(pattern.ttl_minutes) or 15
	expires_at = add_to_date(received_at, minutes=ttl)

	# de-dup exact code for this email within its TTL window
	if (
		inbound.gam_email
		and frappe.db.exists(
			"GAM Email Code",
			{"email": inbound.gam_email, "code": code, "expires_at": [">", received_at]},
		)
	):
		inbound.status = "DUPLICATE"
		inbound.matched_platform = pattern.platform
		inbound.matched_pattern = pattern.name
		inbound.insert(ignore_permissions=True)
		_update_webhook_status("OK")
		return {"status": "duplicate"}

	code_doc = frappe.new_doc("GAM Email Code")
	code_doc.email = inbound.gam_email
	code_doc.email_address = email_account
	code_doc.platform = pattern.platform
	code_doc.code = code
	code_doc.email_subject = subject[:140]
	code_doc.email_from = sender[:140]
	code_doc.received_at = received_at
	code_doc.fetched_at = now_datetime()
	code_doc.expires_at = expires_at
	code_doc.status = "AVAILABLE"
	code_doc.raw_snippet = raw
	code_doc.source_uid = message_id[:140]
	code_doc.insert(ignore_permissions=True)

	inbound.status = "OK"
	inbound.matched_platform = pattern.platform
	inbound.matched_pattern = pattern.name
	inbound.email_code = code_doc.name
	inbound.insert(ignore_permissions=True)

	_update_webhook_status("OK")
	emit_new_code(pattern.platform, code_doc.name)
	return {"status": "ok", "name": code_doc.name}


def _webhook_payload():
	request = getattr(frappe.local, "request", None)
	if request is None:
		return frappe.form_dict or {}
	if request.method == "POST":
		try:
			payload = request.get_json(silent=True)
			if payload:
				return payload
		except Exception:
			pass
		return request.form or frappe.form_dict or {}
	return frappe.form_dict or {}


def _verify_webhook_secret():
	"""Verify X-Webhook-Secret against the GAM Webhook Config singleton (§6.5)."""
	config = frappe.get_doc("GAM Webhook Config", "GAM Webhook Config")
	if not cint(config.is_active):
		frappe.throw(_("Webhook endpoint is disabled."), frappe.PermissionError)

	expected = config.get_password("webhook_secret") or ""
	if not expected:
		frappe.throw(_("Webhook secret is not configured. Set it in GAM Webhook Config."), frappe.PermissionError)

	request = getattr(frappe.local, "request", None)
	provided = request.headers.get("X-Webhook-Secret") if request is not None else ""
	if not provided or provided != expected:
		frappe.throw(_("Invalid webhook secret."), frappe.PermissionError)


def _parse_received_at(raw):
	"""Parse the worker-supplied receipt timestamp into a naive *system-local* datetime.

	The Cloudflare Email Worker sends ``received_at`` in UTC (RFC-2822 / ISO
	with an offset). Every expiry check — :func:`_claim_latest_code`, the
	``expire_email_codes`` scheduler, and the dashboard "available codes" count
	— compares ``expires_at`` against :func:`now_datetime`, which is in the
	Frappe **system** timezone (``System Settings > Time Zone``), **not** the OS
	timezone.

	``parsedate_to_datetime(...).astimezone()`` converts using the *OS*
	timezone, so when the host runs in UTC but the site is configured for
	another zone (e.g. ``Asia/Ho_Chi_Minh`` = UTC+7) the stored value silently
	stays in UTC while every comparison uses local time — every real-webhook
	code then looks already-expired by the full UTC offset (so it appears
	"unavailable" within ~1 second of arrival). Convert explicitly to the
	system timezone so the stored value matches :func:`now_datetime`.
	"""
	if not raw:
		return None
	try:
		aware = parsedate_to_datetime(str(raw))
		return convert_utc_to_system_timezone(aware).replace(tzinfo=None)
	except Exception:
		try:
			dt = frappe.utils.get_datetime(raw)
			if getattr(dt, "tzinfo", None) is not None:
				return convert_utc_to_system_timezone(dt).replace(tzinfo=None)
			return dt
		except Exception:
			return None


def _match_pattern(sender, subject, body):
	patterns = frappe.get_all(
		"GAM Code Pattern",
		filters={"is_active": 1},
		fields=[
			"name",
			"platform",
			"sender_pattern",
			"subject_keywords",
			"code_regex",
			"ttl_minutes",
		],
		order_by="priority desc",
	)
	for p in patterns:
		if p.sender_pattern and not re.search(p.sender_pattern, sender, re.I):
			continue
		if p.subject_keywords:
			keywords = [k.strip().lower() for k in p.subject_keywords.split(",") if k.strip()]
			if keywords and not any(k in (subject or "").lower() for k in keywords):
				continue
		if not p.code_regex:
			continue
		match = re.search(p.code_regex, body or subject, re.I | re.M)
		if not match:
			continue
		code = (match.group(1) if match.groups() else match.group(0)).strip()
		if not code:
			continue
		p["extracted"] = code
		return frappe._dict(p)
	return None


def _update_webhook_status(status):
	"""Bump GAM Webhook Config singleton counters (ignore if missing)."""
	if not frappe.db.exists("GAM Webhook Config", "GAM Webhook Config"):
		return
	config = frappe.get_doc("GAM Webhook Config", "GAM Webhook Config")
	config.last_received_at = now_datetime()
	config.last_status = status
	config.total_received = cint(config.total_received) + 1
	config.save(ignore_permissions=True)


# ============================================================================
# 7. Role-isolation audit (B4 — co-tenancy hardening)
# ============================================================================
# Roles that, when held by a GAM Member, break co-tenancy isolation on a shared
# site (erpnext + trader-ui live on the same erp.local).
ISOLATION_BREAKING_ROLES = {
	"System Manager": "Grants Desk + admin access to EVERY app on the site.",
	"Administrator": "Super-user — full control of the whole site.",
}
GAM_ROLES = {"GAM Admin", "GAM Member"}
# Built-in Frappe roles that are always present and safe.
_BUILTIN_ROLES = {"All", "Guest", "Desktop"}


def _require_gam_admin():
	"""Defense-in-depth guard: only GAM Admin / Administrator may call."""
	caller_roles = set(frappe.get_roles())
	if (
		"GAM Admin" not in caller_roles
		and "Administrator" not in caller_roles
	):
		frappe.throw(
			_("Only GAM Admin can perform this action."),
			frappe.PermissionError,
		)


@frappe.whitelist()
def get_role_audit(user=None):
	"""Audit role isolation for a GAM user (GAM Admin only).

	Returns the user's full role set plus flags for any isolation-breaking
	roles and a list of non-GAM roles to review (erpnext / trader-ui leakage
	on the co-tenant site erp.local).

		{
		  "user": "...",
		  "roles": [...],
		  "is_gam_admin": bool,
		  "is_gam_member": bool,
		  "is_isolated": bool,            # True when no breaking role found
		  "warnings": [{role, reason}],
		  "other_roles": [...]            # non-GAM, non-builtin, non-breaking
		}
	"""
	_require_gam_admin()

	target = user or frappe.session.user
	roles = set(frappe.get_roles(target))
	is_member = "GAM Member" in roles
	is_admin = "GAM Admin" in roles

	warnings = []
	if is_member:
		for role, reason in ISOLATION_BREAKING_ROLES.items():
			if role in roles:
				warnings.append({"role": role, "reason": reason})

	review = sorted(
		roles - GAM_ROLES - _BUILTIN_ROLES - set(ISOLATION_BREAKING_ROLES)
	)

	return {
		"user": target,
		"roles": sorted(roles),
		"is_gam_admin": is_admin,
		"is_gam_member": is_member,
		"is_isolated": len(warnings) == 0,
		"warnings": warnings,
		"other_roles": review,
	}
'''


def main():
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    with open(PATH, "w") as fh:
        fh.write(API)
    print("wrote", PATH)


if __name__ == "__main__":
    main()
