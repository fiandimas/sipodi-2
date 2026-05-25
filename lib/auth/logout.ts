"use client"

export async function logout() {
  // credentials: "same-origin" memastikan cookie httpOnly ikut terkirim ke origin yang sama
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  })
}
