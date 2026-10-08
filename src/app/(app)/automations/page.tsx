import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Automations" };

export default function Page() {
  return <ModulePlaceholder id="automations" />;
}
