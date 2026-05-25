import { getSession } from "@/app/_lib/session"

export async function requireGtkNik() {
  const session = await getSession()
  if (!session?.gtkNik) return null
  return session.gtkNik
}
