import { redirect } from "next/navigation";

export default function VisibilityRedirect() {
  redirect("/personeel?tab=functies");
}
