#!/usr/bin/env python3
"""One-shot generator for the 16 GAM DocTypes (Design §3).

Produces, under ~/frappe-bench/apps/gam/gam/gam/doctype/<snake>/:
  __init__.py, <snake>.py (controller), <snake>.json (meta)

Run from anywhere; deletes nothing. Idempotent (overwrites).
"""
import json
import os

BASE = os.path.expanduser("~/frappe-bench/apps/gam/gam/gam/doctype")

# --- enums -----------------------------------------------------------------
PLATFORMS = "STEAM\nBATTLENET\nXBOX\nEPIC\nSTANDALONE"
CODE_PLATFORMS = "STEAM\nBATTLENET\nPOE\nOTHER"
ACCOUNT_STATUS = "ACTIVE\nBANNED\nINACTIVE\nSUSPENDED"
EMAIL_PROVIDERS = "Gmail\nOutlook\nProton\nYahoo\nOther"
REGIONS = "AMERICAS\nASIA\nEUROPE\nGLOBAL"
LINK_STATUS = "ACTIVE\nEXPIRED\nREVOKED"
REVEAL_ACTION = "REVEAL\nCOPY"
EMAIL_CODE_STATUS = "AVAILABLE\nCLAIMED\nEXPIRED"
CODE_REQUEST_STATUS = "FULFILLED\nNO_CODE\nEXPIRED"
USAGE_STATUS = "IN_USE\nRELEASED\nEXPIRED\nFORCE_RELEASED"
USAGE_PURPOSE = "LOGIN\nLEVELING\nBUILD\nFARMING\nTESTING\nDELIVERY\nOTHER"
END_REASON = "DONE\nCANCELLED\nTIMEOUT\nFORCE_RELEASED\nERROR"
INBOUND_STATUS = "OK\nNO_MATCH\nDUPLICATE\nPARSE_ERROR\nINACTIVE\nPAYLOAD_TRUNCATED"

ADMIN = "GAM Admin"
MEMBER = "GAM Member"
SYSMGR = "System Manager"


def fld(fieldname, fieldtype, label=None, reqd=0, options=None, default=None,
        read_only=0, unique=0, hidden=0, description=None, columns=0,
        in_list_view=0, in_global_search=0):
    d = {"fieldname": fieldname, "fieldtype": fieldtype}
    if label:
        d["label"] = label
    if reqd:
        d["reqd"] = 1
    if options is not None:
        d["options"] = options
    if default is not None:
        d["default"] = default
    if read_only:
        d["read_only"] = 1
    if unique:
        d["unique"] = 1
    if hidden:
        d["hidden"] = 1
    if description:
        d["description"] = description
    if columns:
        d["columns"] = columns
    if in_list_view:
        d["in_list_view"] = 1
    if in_global_search:
        d["in_global_search"] = 1
    return d


def perm(role, read=0, write=0, create=0, delete=0, email=1, print=1, report=1, share=1):
    return {
        "role": role, "read": read, "write": write, "create": create,
        "delete": delete, "email": email, "print": print, "report": report,
        "share": share,
    }


# perms presets -------------------------------------------------------------
def admin_crud_member_read():
    return [
        perm(ADMIN, read=1, write=1, create=1, delete=1),
        perm(MEMBER, read=1),
        perm(SYSMGR, read=1, write=1, create=1, delete=1),
    ]


DOCTYPES = []

def add(name, snake, cls, fields, perms, istable=0, is_single=0, read_only=0,
        track_changes=1, title_field=None, search_fields=None,
        controller_extra="", default_view="List", **extra):
    DOCTYPES.append(dict(name=name, snake=snake, cls=cls, fields=fields,
                         perms=perms, istable=istable, is_single=is_single,
                         read_only=read_only, track_changes=track_changes,
                         title_field=title_field, search_fields=search_fields,
                         controller_extra=controller_extra, default_view=default_view,
                         extra=extra))


# ============================== CHILD TABLES ===============================
add(
    "GAM Email Recovery", "gam_email_recovery", "GAMEmailRecovery",
    [
        fld("address", "Data", label="Address", in_list_view=1, columns=3),
        fld("label", "Data", label="Label", in_list_view=1, columns=2),
    ],
    [perm(ADMIN, read=1, write=1, create=1, delete=1),
     perm(MEMBER, read=1),
     perm(SYSMGR, read=1, write=1, create=1, delete=1)],
    istable=1, track_changes=0,
)

add(
    "GAM Account Game DLC", "gam_account_game_dlc", "GAMAccountGameDLC",
    [
        fld("dlc", "Link", label="DLC", options="GAM DLC", reqd=1, in_list_view=1, columns=3),
        fld("purchased_at", "Datetime", label="Purchased At", in_list_view=1, columns=2),
    ],
    [perm(ADMIN, read=1, write=1, create=1, delete=1),
     perm(MEMBER, read=1),
     perm(SYSMGR, read=1, write=1, create=1, delete=1)],
    istable=1, track_changes=0,
)

add(
    "GAM Account Game", "gam_account_game", "GAMAccountGame",
    [
        fld("game", "Link", label="Game", options="GAM Game", reqd=1, in_list_view=1, columns=2),
        fld("server", "Link", label="Server", options="GAM Game Server", in_list_view=1, columns=2),
        fld("is_main", "Check", label="Is Main", in_list_view=1),
        fld("purchased_at", "Datetime", label="Purchased At"),
        fld("notes", "Data", label="Notes"),
        fld("dlcs", "Table", label="DLCs", options="GAM Account Game DLC"),
    ],
    [perm(ADMIN, read=1, write=1, create=1, delete=1),
     perm(MEMBER, read=1),
     perm(SYSMGR, read=1, write=1, create=1, delete=1)],
    istable=1, track_changes=0,
)

# ============================== MASTER DATA ================================
add(
    "GAM Game", "gam_game", "GAMGame",
    [
        fld("game_name", "Data", label="Game Name", reqd=1, unique=1, in_global_search=1),
        fld("publisher", "Data", label="Publisher"),
        fld("is_active", "Check", label="Is Active", default="1", in_list_view=1),
    ],
    admin_crud_member_read(),
    title_field="game_name", search_fields="game_name",
)

add(
    "GAM Game Server", "gam_game_server", "GAMGameServer",
    [
        fld("game", "Link", label="Game", options="GAM Game", reqd=1, in_list_view=1),
        fld("region", "Select", label="Region", options=REGIONS, reqd=1, in_list_view=1),
        fld("is_active", "Check", label="Is Active", default="1", in_list_view=1),
        fld("notes", "Data", label="Notes"),
    ],
    admin_crud_member_read(),
    search_fields="game,region",
)

add(
    "GAM DLC", "gam_dlc", "GAMDLC",
    [
        fld("game", "Link", label="Game", options="GAM Game", reqd=1, in_list_view=1),
        fld("dlc_name", "Data", label="DLC Name", reqd=1, in_list_view=1),
        fld("release_date", "Date", label="Release Date"),
    ],
    admin_crud_member_read(),
    search_fields="dlc_name,game",
)

# ============================== EMAIL / ACCOUNT ============================
add(
    "GAM Email", "gam_email", "GAMEmail",
    [
        fld("address", "Data", label="Address", reqd=1, unique=1, in_global_search=1),
        fld("email_password", "Password", label="Email Password", description="Frappe encrypts this on save."),
        fld("provider", "Select", label="Provider", options=EMAIL_PROVIDERS),
        fld("notes", "Small Text", label="Notes"),
        fld("is_active", "Check", label="Is Active", default="1", in_list_view=1),
        fld("forward_verified", "Check", label="Forward Verified", default="0",
            description="Admin marks when email forwarding to the Cloudflare inbox is set up."),
        fld("recovery_emails", "Table", label="Recovery Emails", options="GAM Email Recovery"),
    ],
    admin_crud_member_read(),
    title_field="address", search_fields="address,provider",
)

add(
    "GAM Account", "gam_account", "GAMAccount",
    [
        # platform/status are free-form Data so admins can add custom options
        # via the GAM List Option configurable lists (see plans/accounts-email-redesign.md).
        # The seeded values (PLATFORMS/ACCOUNT_STATUS) keep existing data valid.
        fld("platform", "Data", label="Platform", reqd=1, in_list_view=1, description="Configurable via GAM List Option (category=Platform)."),
        fld("username", "Data", label="Username", reqd=1, in_global_search=1),
        fld("account_password", "Password", label="Account Password"),
        fld("totp_secret", "Password", label="TOTP Secret", description="Secret key for 2FA / Authenticator app."),
        fld("email", "Link", label="Email", options="GAM Email", reqd=1, in_list_view=1),
        fld("source", "Data", label="Source"),
        fld("status", "Data", label="Status", default="ACTIVE", in_list_view=1, description="Configurable via GAM List Option (category=Account Status)."),
        fld("notes", "Small Text", label="Notes"),
        fld("account_created_at", "Datetime", label="Account Created At"),
        fld("purchased_at", "Datetime", label="Purchased At"),
        # NOTE: account→(role,game) bindings now live in the first-class
        # "GAM Account Role Game" doctype (hand-maintained, like GAM Access Grant).
        # The legacy GAM Account Game child table is retained only for migration.
    ],
    admin_crud_member_read(),
    title_field="username", search_fields="username,email,platform",
)

# ============================== ACCOUNT LINK ===============================
LINK_CONTROLLER = '''
	def validate(self):
		if self.source_account and self.target_account and self.source_account == self.target_account:
			frappe.throw(_("An account cannot be linked to itself."))

		# prevent duplicate links in either direction
		if self.source_account and self.target_account:
			exists = frappe.db.exists(
				"GAM Account Link",
				{
					"name": ["!=", self.name or ""],
					"status": "ACTIVE",
					"source_account": ["in", [self.source_account, self.target_account]],
					"target_account": ["in", [self.source_account, self.target_account]],
				},
			)
			if exists:
				frappe.throw(_("An active link between these two accounts already exists."))
'''

add(
    "GAM Account Link", "gam_account_link", "GAMAccountLink",
    [
        fld("source_account", "Link", label="Source Account", options="GAM Account", reqd=1, in_list_view=1),
        fld("target_account", "Link", label="Target Account", options="GAM Account", reqd=1, in_list_view=1),
        fld("link_type", "Data", label="Link Type", description="e.g. STEAM_TO_BNET"),
        fld("status", "Select", label="Status", options=LINK_STATUS, default="ACTIVE", in_list_view=1),
        fld("expiry_date", "Datetime", label="Expiry Date", in_list_view=1),
        fld("notes", "Data", label="Notes"),
    ],
    admin_crud_member_read(),
    track_changes=1,
    controller_extra=LINK_CONTROLLER,
)

# ============================== EMAIL CODE =================================
add(
    "GAM Email Code", "gam_email_code", "GAMEmailCode",
    [
        fld("email", "Link", label="Email", options="GAM Email", in_list_view=1),
        fld("email_address", "Data", label="Email Address", description="Fallback if not matched to a GAM Email."),
        fld("platform", "Select", label="Platform", options=CODE_PLATFORMS, reqd=1, in_list_view=1),
        fld("code", "Data", label="Code", reqd=1, in_list_view=1),
        fld("email_subject", "Data", label="Email Subject"),
        fld("email_from", "Data", label="From"),
        fld("received_at", "Datetime", label="Received At", reqd=1, in_list_view=1),
        fld("fetched_at", "Datetime", label="Fetched At"),
        fld("expires_at", "Datetime", label="Expires At", in_list_view=1),
        fld("status", "Select", label="Status", options=EMAIL_CODE_STATUS, default="AVAILABLE", in_list_view=1),
        fld("claimed_by", "Link", label="Claimed By", options="User"),
        fld("claimed_at", "Datetime", label="Claimed At"),
        fld("raw_snippet", "Small Text", label="Raw Snippet"),
        fld("source_uid", "Data", label="Source UID", hidden=1),
    ],
    [perm(ADMIN, read=1, write=1, create=1, delete=1),
     perm(SYSMGR, read=1, write=1, create=1, delete=1)],
    title_field="code", search_fields="email,code,platform",
)

# ============================== CODE PATTERN ===============================
add(
    "GAM Code Pattern", "gam_code_pattern", "GAMCodePattern",
    [
        fld("platform", "Select", label="Platform", options=CODE_PLATFORMS, in_list_view=1),
        fld("sender_pattern", "Data", label="Sender Pattern", description="Regex matched against sender email."),
        fld("subject_keywords", "Data", label="Subject Keywords", description="Comma-separated."),
        fld("code_regex", "Data", label="Code Regex", description="Regex; group 1 = the code."),
        fld("ttl_minutes", "Int", label="TTL (minutes)", default="15"),
        fld("is_active", "Check", label="Is Active", default="1", in_list_view=1),
        fld("priority", "Int", label="Priority", default="0"),
    ],
    admin_crud_member_read(),
    search_fields="platform",
)

# ============================== ACCOUNT USAGE ==============================
add(
    "GAM Account Usage", "gam_account_usage", "GAMAccountUsage",
    [
        fld("account", "Link", label="Account", options="GAM Account", reqd=1, in_list_view=1),
        fld("status", "Select", label="Status", options=USAGE_STATUS, reqd=1, in_list_view=1),
        fld("used_by", "Link", label="Used By", options="User", reqd=1, in_list_view=1),
        fld("purpose", "Data", label="Purpose", in_list_view=1,
            description="Mục đích sử dụng (tùy chỉnh, datalist ở FE gợi ý preset)."),
        fld("order_ref", "Data", label="Order Ref"),
        fld("started_at", "Datetime", label="Started At", reqd=1, in_list_view=1),
        fld("lease_until", "Datetime", label="Lease Until", reqd=1, in_list_view=1),
        fld("ended_at", "Datetime", label="Ended At"),
        fld("end_reason", "Select", label="End Reason", options=END_REASON),
        fld("notes", "Small Text", label="Notes"),
    ],
    [perm(ADMIN, read=1, write=1, create=1, delete=1),
     perm(MEMBER, read=1),
     perm(SYSMGR, read=1, write=1, create=1, delete=1)],
    search_fields="account,used_by,status",
)

# ============================== ACCOUNT NOTES ==============================
NOTE_CONTROLLER = '''
	def before_insert(self):
		if not self.note_by:
			self.note_by = frappe.session.user
		if not self.created_at:
			self.created_at = frappe.utils.now_datetime()
'''

add(
    "GAM Account Note", "gam_account_note", "GAMAccountNote",
    [
        fld("account", "Link", label="Account", options="GAM Account", reqd=1, in_list_view=1),
        fld("note_by", "Link", label="Note By", options="User", reqd=1, in_list_view=1),
        fld("content", "Text Editor", label="Content", reqd=1),
        fld("created_at", "Datetime", label="Created At", reqd=1, in_list_view=1),
    ],
    [perm(ADMIN, read=1, write=1, create=1, delete=1),
     perm(MEMBER, read=1, create=1),
     perm(SYSMGR, read=1, write=1, create=1, delete=1)],
    search_fields="account,note_by",
    controller_extra=NOTE_CONTROLLER,
)

# ============================== AUDIT LOGS (read only) =====================
add(
    "GAM Reveal Log", "gam_reveal_log", "GAMRevealLog",
    [
        fld("action", "Select", label="Action", options=REVEAL_ACTION, default="REVEAL", in_list_view=1),
        fld("viewed_by", "Link", label="Viewed By", options="User", in_list_view=1),
        fld("target_doctype", "Data", label="Target DocType", in_list_view=1),
        fld("target_name", "Data", label="Target Name", in_list_view=1),
        fld("fieldname", "Data", label="Fieldname", in_list_view=1),
        fld("ip_address", "Data", label="IP Address"),
        fld("user_agent", "Small Text", label="User Agent"),
        fld("viewed_at", "Datetime", label="Viewed At", in_list_view=1),
    ],
    [perm(ADMIN, read=1), perm(SYSMGR, read=1)],
    read_only=1, track_changes=0,
)

add(
    "GAM Code Request Log", "gam_code_request_log", "GAMCodeRequestLog",
    [
        fld("requested_by", "Link", label="Requested By", options="User", reqd=1, in_list_view=1),
        fld("email_code", "Link", label="Email Code", options="GAM Email Code"),
        fld("target_email", "Link", label="Target Email", options="GAM Email", reqd=1, in_list_view=1),
        fld("target_account", "Link", label="Target Account", options="GAM Account", in_list_view=1),
        fld("platform", "Data", label="Platform", in_list_view=1),
        fld("code_value", "Data", label="Code Value", in_list_view=1),
        fld("status", "Select", label="Status", options=CODE_REQUEST_STATUS, reqd=1, in_list_view=1),
        fld("requested_at", "Datetime", label="Requested At", reqd=1, in_list_view=1),
        fld("notes", "Small Text", label="Notes"),
    ],
    [perm(ADMIN, read=1), perm(SYSMGR, read=1)],
    read_only=1, track_changes=0,
)

add(
    "GAM Email Inbound Log", "gam_email_inbound_log", "GAMEmailInboundLog",
    [
        fld("email_account", "Data", label="Email Account", in_list_view=1),
        fld("gam_email", "Link", label="GAM Email", options="GAM Email", in_list_view=1),
        fld("email_from", "Data", label="From", in_list_view=1),
        fld("email_subject", "Data", label="Subject", in_list_view=1),
        fld("message_id", "Data", label="Message ID"),
        fld("received_at", "Datetime", label="Received At", in_list_view=1),
        fld("fetched_at", "Datetime", label="Fetched At"),
        fld("status", "Select", label="Status", options=INBOUND_STATUS, in_list_view=1),
        fld("matched_platform", "Data", label="Matched Platform"),
        fld("matched_pattern", "Link", label="Matched Pattern", options="GAM Code Pattern"),
        fld("email_code", "Link", label="Email Code", options="GAM Email Code"),
        fld("raw_snippet", "Small Text", label="Raw Snippet"),
        fld("error_message", "Small Text", label="Error Message"),
    ],
    [perm(ADMIN, read=1, delete=1), perm(SYSMGR, read=1, delete=1)],
    read_only=1, track_changes=0,
)

# ============================== WEBHOOK CONFIG (singleton) =================
add(
    "GAM Webhook Config", "gam_webhook_config", "GAMWebhookConfig",
    [
        fld("webhook_email", "Data", label="Webhook Email",
            description="Inbox the Cloudflare Email Worker forwards to (e.g. gam@yourdomain.com)."),
        fld("webhook_secret", "Password", label="Webhook Secret",
            description="Shared secret verified via X-Webhook-Secret header."),
        # Cloudflare Tunnel / Worker wizard fields (P1.2).
        fld("public_host", "Data", label="Public Host",
            description="Public hostname routed via the Cloudflare Tunnel (e.g. gam.example.com)."),
        fld("cloudflare_tunnel_token", "Password", label="Cloudflare Tunnel Token"),
        fld("cloudflare_api_token", "Password", label="Cloudflare API Token"),
        fld("cloudflare_account_id", "Data", label="Cloudflare Account ID"),
        fld("cf_worker_deployed", "Check", label="CF Worker Deployed", default="0"),
        fld("cf_email_routing_done", "Check", label="CF Email Routing Done", default="0"),
        fld("is_active", "Check", label="Is Active", default="1"),
        fld("last_received_at", "Datetime", label="Last Received At", read_only=1),
        fld("last_status", "Data", label="Last Status", read_only=1),
        fld("total_received", "Int", label="Total Received", read_only=1, default="0"),
    ],
    [perm(ADMIN, read=1, write=1), perm(SYSMGR, read=1, write=1)],
    is_single=1, track_changes=1, default_view="Form",
)

# ============================== GAM SETTINGS (singleton) ==================
add(
    "GAM Settings", "gam_settings", "GAMSettings",
    [
        fld("max_online_hours", "Int", label="Max Online Hours (warning)", default="8",
            description="Ngưỡng online liên tục (giờ). Vượt qua sẽ popup cảnh báo."),
        fld("min_rested_hours", "Int", label="Min Rested Hours (ready badge)", default="8",
            description="Ngưỡng nghỉ tối thiểu (giờ) để gắn tag 'đã nghỉ đủ'."),
        fld("hard_cap_online_hours", "Int", label="Hard Cap Online Hours (auto release)", default="12",
            description="Hạn cứng (giờ). Lease tự force-release khi vượt (lease_until = started_at + giá trị này)."),
        fld("block_logout_with_active_lease", "Check", label="Warn On Logout With Active Lease", default="1",
            description="Bật cảnh báo (không block cứng) khi logout mà còn lease."),
    ],
    [perm(ADMIN, read=1, write=1), perm(MEMBER, read=1), perm(SYSMGR, read=1, write=1)],
    is_single=1, track_changes=1, default_view="Form",
)


# =============================== WRITERS ===================================
def build_meta(d):
    meta = {
        "doctype": "DocType",
        "name": d["name"],
        "module": "GAM",
        "engine": "InnoDB",
        "fields": d["fields"],
        "permissions": d["perms"],
        "default_view": d["default_view"],
        "quick_entry": 0,
        "sort_field": "modified",
        "sort_order": "DESC",
        "track_changes": 1 if d["track_changes"] else 0,
    }
    if d["istable"]:
        meta["istable"] = 1
        meta["track_changes"] = 0
    if d["is_single"]:
        meta["issingle"] = 1
        meta["default_view"] = "Form"
        meta["track_changes"] = 1 if d["track_changes"] else 0
    if d["read_only"]:
        meta["read_only"] = 1
        meta["in_create"] = 1
    if d["title_field"]:
        meta["title_field"] = d["title_field"]
    if d["search_fields"]:
        meta["search_fields"] = d["search_fields"]
    meta.update(d["extra"])
    return meta


def controller_source(d):
    needs_translate = bool(d["controller_extra"])
    lines = []
    lines.append("import frappe")
    if needs_translate:
        lines.append("from frappe import _")
    lines.append("from frappe.model.document import Document")
    lines.append("")
    lines.append("")
    lines.append(f"class {d['cls']}(Document):")
    if d["controller_extra"]:
        body = d["controller_extra"].strip("\n").splitlines()
    else:
        body = ["\tpass"]
    for bl in body:
        lines.append(bl if bl.strip() else "")
    return "\n".join(lines) + "\n"


def main():
    os.makedirs(BASE, exist_ok=True)
    # ensure doctype package init
    open(os.path.join(BASE, "__init__.py"), "w").close()
    for d in DOCTYPES:
        folder = os.path.join(BASE, d["snake"])
        os.makedirs(folder, exist_ok=True)
        # __init__.py
        open(os.path.join(folder, "__init__.py"), "w").close()
        # json
        with open(os.path.join(folder, f"{d['snake']}.json"), "w") as fh:
            json.dump(build_meta(d), fh, indent=1, ensure_ascii=False)
            fh.write("\n")
        # py
        with open(os.path.join(folder, f"{d['snake']}.py"), "w") as fh:
            fh.write(controller_source(d))
        print(f"wrote {d['name']} ({d['snake']})")
    print(f"\n{len(DOCTYPES)} doctypes generated under {BASE}")


if __name__ == "__main__":
    main()
