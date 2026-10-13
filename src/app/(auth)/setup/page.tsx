import type { Metadata } from "next";
import { AuthScreen } from "../auth-screen";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage() {
  return <AuthScreen initial="setup" />;
}
