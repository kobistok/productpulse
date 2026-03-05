const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? "kobi.stok@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export function isSuperAdmin(email: string): boolean {
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
