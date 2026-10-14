import type { Metadata } from "next";
import { SetupScreen } from "../auth-screen";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage() {
  return <SetupScreen />;
}
