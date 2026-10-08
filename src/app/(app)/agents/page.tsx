import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Agents" };

export default function Page() {
  return <ModulePlaceholder id="agents" />;
}
