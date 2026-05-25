export type UserRole = "GTK" | "Admin Sekolah" | "Admin Talenta";

export interface User {
  id: string;
  email: string;
  password?: string; 
  role: UserRole;
  gtk?: string; 
  sekolah?: string;
  status?: "Active" | "Inactive";
}
