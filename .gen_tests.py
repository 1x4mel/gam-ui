#!/usr/bin/env python3
"""Write the GAM backend pytest suite into ~/frappe-bench/apps/gam/gam/tests/.

Idempotent. Fills the gap flagged in .ai/coding-standards.md ("Definition of
done: bench --site erp.local run-tests --app gam") — there were zero backend
tests despite a fully implemented B0-B4 API surface.

Coverage (per coding standards): webhook parse, code extraction, atomic claim,
permission deny, role isolation — plus reveal audit, checkout/check-in lease
lifecycle, dashboard stats, global search and the GAM Account Link controller.

Run:   bench --site erp.local run-tests --app gam
"""
import os

BASE = os.path.expanduser("~/frappe-bench/apps/gam/gam/tests")


def write(relpath, content):
    full = os.path.join(BASE, relpath)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as fh:
        fh.write(content)
    print("wrote tests/" + relpath)


INIT = """# GAM tests package
"""

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
UTILS = r'''# Copyright (c) 2026, GAM and contributors
# License: MIT
"""Shared fixtures for the GAM backend test suite.

Each helper is idempotent (defensive delete-first) so tests are robust even
when Frappe's per-method transaction rollback is not in effect.
"""
import frappe

TEST_ADDRESS = "unit-test@gam.test"
TEST_USERNAME = "unit_test_steam"


def _delete_if(doctype, filters):
	"""Force-delete docs matching *filters* (ignore missing)."""
	for name in frappe.get_all(doctype, filters=filters, pluck="name"):
		frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)


def purge_fixtures():
	"""Remove any leftover GAM rows produced by this suite (dependency order)."""
	_delete_if("GAM Reveal Log", {"target_name": ["like", "unit%"]})
	_delete_if("GAM Code Request Log", {"target_email": ["like", "%@gam.test%"]})
	_delete_if("GAM Email Inbound Log", {"email_account": ["like", "%@gam.test%"]})
	_delete_if("GAM Email Code", {"email_address": ["like", "%@gam.test%"]})
	_delete_if("GAM Account Usage", {"account": ["like", "unit%"]})
	_delete_if("GAM Account Link", {"source_account": ["like", "unit%"]})
	_delete_if("GAM Account", {"username": ["like", "unit%"]})
	_delete_if("GAM Email", {"address": ["like", "%@gam.test%"]})


def make_email(address=TEST_ADDRESS, password="emailpw", provider="Gmail"):
	"""Create (or recreate) a GAM Email; return its doc name."""
	purge_email(address)
	doc = frappe.get_doc(
		{
			"doctype": "GAM Email",
			"address": address,
			"email_password": password,
			"provider": provider,
			"is_active": 1,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def purge_email(address):
	name = frappe.db.get_value("GAM Email", {"address": address})
	if name:
		frappe.delete_doc("GAM Email", name, force=True, ignore_permissions=True)


def make_account(platform, username, email_name, password="accpw456",
                 totp_secret="", status="ACTIVE", source="Unit Test"):
	"""Create (or recreate) a GAM Account; return its doc name."""
	purge_account(username)
	doc = frappe.get_doc(
		{
			"doctype": "GAM Account",
			"platform": platform,
			"username": username,
			"account_password": password,
			"totp_secret": totp_secret,
			"email": email_name,
			"status": status,
			"source": source,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def purge_account(username):
	name = frappe.db.get_value("GAM Account", {"username": username})
	if name:
		frappe.delete_doc("GAM Account", name, force=True, ignore_permissions=True)


def ensure_user(email, roles):
	"""Create/ensure a User with EXACTLY the given roles (plus 'All')."""
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": email.split("@")[0].title(),
				"enabled": 1,
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
	user = frappe.get_doc("User", email)
	user.roles = []
	for role in sorted(set(roles) | {"All"}):
		user.append("roles", {"role": role})
	user.save(ignore_permissions=True)
	return email


def set_webhook_secret(secret, active=1):
	"""Set the GAM Webhook Config singleton secret + active flag."""
	cfg = frappe.get_doc("GAM Webhook Config", "GAM Webhook Config")
	cfg.webhook_secret = secret
	cfg.is_active = 1 if active else 0
	cfg.save(ignore_permissions=True)
'''


# ---------------------------------------------------------------------------
# test_api.py — the whitelisted API surface
# ---------------------------------------------------------------------------
TEST_API = r'''# Copyright (c) 2026, GAM and contributors
# License: MIT
"""Unit tests for gam.api — the whitelisted surface consumed by gam-ui.

Run:  bench --site erp.local run-tests --app gam
"""
import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime

from gam import api
from gam.tests.utils import (
	TEST_ADDRESS,
	TEST_USERNAME,
	ensure_user,
	make_account,
	make_email,
	purge_fixtures,
	set_webhook_secret,
)


class _MockRequest:
	"""Minimal stand-in for flask.request consumed by receive_email_webhook."""

	def __init__(self, json_data=None, headers=None, method="POST"):
		self.method = method
		self._json = json_data
		self.headers = headers or {}
		self.remote_addr = "127.0.0.1"
		self.form = {}

	def get_json(self, silent=True):
		return self._json


class TestWebhookParse(FrappeTestCase):
	"""Code-pattern matching + regex extraction (Design §7.2)."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		from gam.setup import seed_code_patterns
		seed_code_patterns()

	def test_steam_code_extracted(self):
		p = api._match_pattern(
			"noreply@steampowered.com",
			"Steam Guard verification code",
			"Your verification code: 5QR9Z",
		)
		self.assertIsNotNone(p)
		self.assertEqual(p.platform, "STEAM")
		self.assertEqual(p.extracted, "5QR9Z")

	def test_battlenet_code_extracted(self):
		p = api._match_pattern(
			"noreply@battle.net",
			"Battle.net security code",
			"Your security code: 482917",
		)
		self.assertIsNotNone(p)
		self.assertEqual(p.platform, "BATTLENET")
		self.assertEqual(p.extracted, "482917")

	def test_poe_code_extracted(self):
		p = api._match_pattern(
			"support@grindinggear.com",
			"Path of Exile verification",
			"Your verification code: PoE42x",
		)
		self.assertIsNotNone(p)
		self.assertEqual(p.platform, "POE")
		self.assertEqual(p.extracted, "PoE42x")

	def test_unknown_sender_no_match(self):
		self.assertIsNone(
			api._match_pattern("spam@example.com", "verification code", "code: ABCDE")
		)

	def test_subject_keyword_gate_blocks(self):
		# Right sender + body but an unrelated subject must NOT match.
		self.assertIsNone(
			api._match_pattern(
				"noreply@steampowered.com", "Newsletter", "verification code: 5QR9Z"
			)
		)

	def test_parse_received_at_rfc2822(self):
		self.assertIsNotNone(api._parse_received_at("Mon, 15 Jun 2026 12:00:00 +0000"))

	def test_parse_received_at_invalid(self):
		self.assertIsNone(api._parse_received_at(None))
		self.assertIsNone(api._parse_received_at("not-a-date"))

	def test_parse_received_at_converts_utc_to_system_timezone(self):
		# Regression for the "Chưa có code mới" bug: the Cloudflare worker sends
		# received_at in UTC, but every expiry check compares against
		# now_datetime() (Frappe system timezone, NOT the OS timezone). Parsing
		# MUST convert UTC -> system tz, otherwise a freshly-arrived code looks
		# already-expired by the full tz offset. Feed the current UTC moment and
		# assert the parsed value tracks now_datetime(), not datetime.utcnow().
		from datetime import datetime, timezone
		from email.utils import format_datetime

		utc_now = datetime.now(timezone.utc)
		parsed = api._parse_received_at(format_datetime(utc_now))
		sys_now = frappe.utils.now_datetime()
		delta = abs((parsed - sys_now).total_seconds())
		self.assertLess(
			delta,
			120,
			f"parsed {parsed} != now_datetime() {sys_now} (delta {delta}s) "
			"— UTC receipt time not converted to system timezone",
		)


class TestRevealPassword(FrappeTestCase):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		purge_fixtures()
		self.email = make_email()
		self.account = make_account("STEAM", TEST_USERNAME, self.email, password="accpw456")

	def test_reveal_returns_plaintext_and_audits(self):
		res = api.reveal_password("GAM Account", self.account, "account_password")
		self.assertEqual(res["password"], "accpw456")
		log = frappe.get_last_doc(
			"GAM Reveal Log",
			filters={"target_name": self.account, "fieldname": "account_password"},
		)
		self.assertEqual(log.action, "REVEAL")
		self.assertEqual(log.viewed_by, "Administrator")

	def test_reveal_non_whitelisted_field_denied(self):
		with self.assertRaises(frappe.ValidationError):
			api.reveal_password("GAM Account", self.account, "notes")


class TestRequestCode(FrappeTestCase):
	"""Atomic claim lifecycle (Design §5.3)."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		purge_fixtures()
		self.email = make_email()
		self.account = make_account("STEAM", TEST_USERNAME, self.email)

	def _make_code(self, code="AB12C", platform="STEAM", expires_in_min=10):
		now = now_datetime()
		return frappe.get_doc(
			{
				"doctype": "GAM Email Code",
				"email": self.email,
				"email_address": TEST_ADDRESS,
				"platform": platform,
				"code": code,
				"received_at": now,
				"expires_at": add_to_date(now, minutes=expires_in_min),
				"status": "AVAILABLE",
			}
		).insert(ignore_permissions=True)

	def test_claim_returns_code_and_marks_claimed(self):
		code_doc = self._make_code("AB12C")
		res = api.request_code(email_name=self.email, platform="STEAM")
		self.assertEqual(res["status"], "ok")
		self.assertEqual(res["code"], "AB12C")
		code_doc.reload()
		self.assertEqual(code_doc.status, "CLAIMED")
		self.assertEqual(code_doc.claimed_by, "Administrator")
		log = frappe.get_last_doc("GAM Code Request Log", {"target_email": self.email})
		self.assertEqual(log.status, "FULFILLED")

	def test_second_request_after_claim_is_no_code(self):
		self._make_code("AB12C")
		api.request_code(email_name=self.email, platform="STEAM")
		res = api.request_code(email_name=self.email, platform="STEAM")
		self.assertEqual(res["status"], "no_code")
		log = frappe.get_last_doc("GAM Code Request Log", {"target_email": self.email})
		self.assertEqual(log.status, "NO_CODE")

	def test_expired_code_not_claimed(self):
		self._make_code("AB12C", expires_in_min=-5)  # already expired
		res = api.request_code(email_name=self.email, platform="STEAM")
		self.assertEqual(res["status"], "no_code")

	def test_resolve_platform_from_account(self):
		# request_code without an explicit platform should resolve STEAM from the account.
		self._make_code("CD34E")
		res = api.request_code(account_name=self.account)
		self.assertEqual(res["status"], "ok")
		self.assertEqual(res["code"], "CD34E")


class TestCheckoutLease(FrappeTestCase):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		purge_fixtures()
		self.email = make_email()
		self.account = make_account("STEAM", TEST_USERNAME, self.email)

	def test_checkout_creates_in_use_lease(self):
		usage = api.checkout_account(self.account, purpose="LOGIN", lease_minutes=60)
		self.assertEqual(usage["status"], "IN_USE")
		self.assertEqual(usage["used_by"], "Administrator")

	def test_same_user_recheckout_returns_existing(self):
		first = api.checkout_account(self.account)
		second = api.checkout_account(self.account)
		self.assertEqual(second["name"], first["name"])

	def test_checkin_releases(self):
		api.checkout_account(self.account)
		released = api.checkin_account(self.account, end_reason="DONE")
		self.assertEqual(released["status"], "RELEASED")

	def test_other_user_checkout_blocked(self):
		api.checkout_account(self.account)
		other = ensure_user("checkout-other@gam.test", ["GAM Admin"])
		frappe.set_user(other)
		try:
			with self.assertRaises(frappe.ValidationError):
				api.checkout_account(self.account)
		finally:
			frappe.set_user("Administrator")
			frappe.delete_doc("User", other, force=True, ignore_permissions=True)

	def test_expired_lease_auto_released_on_checkout(self):
		# create a stale IN_USE lease whose lease_until is in the past
		now = now_datetime()
		frappe.get_doc(
			{
				"doctype": "GAM Account Usage",
				"account": self.account,
				"status": "IN_USE",
				"used_by": "Administrator",
				"purpose": "LOGIN",
				"started_at": add_to_date(now, minutes=-200),
				"lease_until": add_to_date(now, minutes=-100),
			}
		).insert(ignore_permissions=True)
		usage = api.checkout_account(self.account)  # should auto-release the stale one
		self.assertEqual(usage["status"], "IN_USE")


class TestWebhookEndpoint(FrappeTestCase):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		purge_fixtures()
		from gam.setup import seed_code_patterns
		seed_code_patterns()
		set_webhook_secret("unit-test-secret", active=1)
		self.email = make_email()

	def _post(self, payload, secret):
		old = getattr(frappe.local, "request", None)
		frappe.local.request = _MockRequest(
			json_data=payload, headers={"X-Webhook-Secret": secret} if secret else {}
		)
		try:
			return api.receive_email_webhook()
		finally:
			frappe.local.request = old

	def test_wrong_secret_denied(self):
		with self.assertRaises(frappe.PermissionError):
			self._post({"from": "x@steampowered.com"}, "WRONG")

	def test_disabled_webhook_denied(self):
		set_webhook_secret("unit-test-secret", active=0)
		with self.assertRaises(frappe.PermissionError):
			self._post({"from": "x@steampowered.com"}, "unit-test-secret")

	def test_happy_path_creates_email_code(self):
		result = self._post(
			{
				"email_account": TEST_ADDRESS,
				"from": "noreply@steampowered.com",
				"subject": "Steam Guard verification code",
				"body": "Your verification code: 5QR9Z",
				"message_id": "unit-test-msg-001",
				"received_at": "Mon, 15 Jun 2026 12:00:00 +0000",
			},
			"unit-test-secret",
		)
		self.assertEqual(result["status"], "ok")
		code_doc = frappe.get_last_doc(
			"GAM Email Code", {"email_address": TEST_ADDRESS, "code": "5QR9Z"}
		)
		self.assertEqual(code_doc.platform, "STEAM")
		self.assertEqual(code_doc.status, "AVAILABLE")
		log = frappe.get_last_doc("GAM Email Inbound Log", {"message_id": "unit-test-msg-001"})
		self.assertEqual(log.status, "OK")

	def test_no_match_logs_and_returns_no_match(self):
		result = self._post(
			{
				"email_account": TEST_ADDRESS,
				"from": "random@example.com",
				"subject": "Hello",
				"body": "nothing useful here",
				"message_id": "unit-test-msg-002",
			},
			"unit-test-secret",
		)
		self.assertEqual(result["status"], "no_match")
		log = frappe.get_last_doc("GAM Email Inbound Log", {"message_id": "unit-test-msg-002"})
		self.assertEqual(log.status, "NO_MATCH")

	def test_duplicate_message_id(self):
		payload = {
			"email_account": TEST_ADDRESS,
			"from": "noreply@steampowered.com",
			"subject": "Steam Guard verification code",
			"body": "Your verification code: 6RQ1Y",
			"message_id": "unit-test-msg-dup",
			"received_at": "Mon, 15 Jun 2026 12:00:00 +0000",
		}
		self.assertEqual(self._post(payload, "unit-test-secret")["status"], "ok")
		# same message_id again -> duplicate
		self.assertEqual(self._post(payload, "unit-test-secret")["status"], "duplicate")


class TestDashboardAndSearch(FrappeTestCase):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		purge_fixtures()
		self.email = make_email()
		self.account = make_account("STEAM", TEST_USERNAME, self.email)

	def test_dashboard_stats_shape(self):
		stats = api.get_dashboard_stats()
		for key in (
			"total_accounts",
			"banned_accounts",
			"total_emails",
			"available_codes",
			"expiring_links_count",
			"expiring_links",
		):
			self.assertIn(key, stats)
		self.assertGreaterEqual(stats["total_accounts"], 1)
		self.assertGreaterEqual(stats["total_emails"], 1)

	def test_global_search_finds_account(self):
		res = api.global_search(TEST_USERNAME)
		self.assertTrue(any(a["username"] == TEST_USERNAME for a in res["accounts"]))

	def test_global_search_short_query_empty(self):
		self.assertEqual(
			api.global_search("a"),
			{"accounts": [], "emails": [], "games": []},
		)


class TestRoleAudit(FrappeTestCase):
	"""Role-isolation audit (B4 — co-tenancy hardening)."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")

	def test_admin_can_audit_self(self):
		res = api.get_role_audit()
		self.assertIn("Administrator", res["roles"])
		self.assertTrue(res["is_gam_admin"] or "Administrator" in res["roles"])

	def test_member_with_breaking_role_flagged(self):
		user = ensure_user("iso-member@gam.test", ["GAM Member", "System Manager"])
		try:
			audit = api.get_role_audit(user=user)
			self.assertFalse(audit["is_isolated"])
			warned = [w["role"] for w in audit["warnings"]]
			self.assertIn("System Manager", warned)
		finally:
			frappe.delete_doc("User", user, force=True, ignore_permissions=True)

	def test_clean_member_isolated(self):
		user = ensure_user("clean-member@gam.test", ["GAM Member"])
		try:
			audit = api.get_role_audit(user=user)
			self.assertTrue(audit["is_isolated"])
			self.assertEqual(audit["warnings"], [])
		finally:
			frappe.delete_doc("User", user, force=True, ignore_permissions=True)

	def test_member_denied_audit(self):
		user = ensure_user("plain-member@gam.test", ["GAM Member"])
		frappe.set_user(user)
		try:
			with self.assertRaises(frappe.PermissionError):
				api.get_role_audit()
		finally:
			frappe.set_user("Administrator")
			frappe.delete_doc("User", user, force=True, ignore_permissions=True)
'''


# ---------------------------------------------------------------------------
# test_doctype.py — GAM Account Link controller validation
# ---------------------------------------------------------------------------
TEST_DOCTYPE = r'''# Copyright (c) 2026, GAM and contributors
# License: MIT
"""Controller validation tests for GAM Account Link (anti-self + unique)."""
import frappe
from frappe.tests.utils import FrappeTestCase

from gam.tests.utils import make_account, make_email, purge_fixtures


class TestAccountLinkValidation(FrappeTestCase):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		purge_fixtures()
		self.email = make_email("link-test@gam.test")
		self.acc_a = make_account("STEAM", "unit_link_a", self.email)
		self.acc_b = make_account("STEAM", "unit_link_b", self.email)

	def _link(self, source, target):
		return frappe.get_doc(
			{
				"doctype": "GAM Account Link",
				"source_account": source,
				"target_account": target,
				"status": "ACTIVE",
			}
		)

	def test_valid_link_inserts(self):
		name = self._link(self.acc_a, self.acc_b).insert(ignore_permissions=True).name
		self.assertTrue(frappe.db.exists("GAM Account Link", name))

	def test_anti_self_link(self):
		with self.assertRaises(frappe.ValidationError):
			self._link(self.acc_a, self.acc_a).insert(ignore_permissions=True)

	def test_duplicate_blocked_both_directions(self):
		self._link(self.acc_a, self.acc_b).insert(ignore_permissions=True)
		# reverse direction is also a duplicate
		with self.assertRaises(frappe.ValidationError):
			self._link(self.acc_b, self.acc_a).insert(ignore_permissions=True)
'''


def main():
    write("__init__.py", INIT)
    write("utils.py", UTILS)
    write("test_api.py", TEST_API)
    write("test_doctype.py", TEST_DOCTYPE)


if __name__ == "__main__":
    main()
