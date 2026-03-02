import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function RootPage() {
  const user = await getSession();
  if (user) {
    redirect("/product-lines");
  }
  redirect("/login");
}
