import Form from "next/form";
import { buttonClass } from "@/components/ui/primitives";

/** One line under the greeting: type a question, land on AI Command with it. */
export function AskBar() {
  return (
    <Form
      action="/command"
      className="mb-10 flex max-w-3xl animate-rise items-center gap-2 rounded-full border border-line bg-paper p-1.5 pl-5 transition-colors focus-within:border-ink hover:border-ink"
    >
      <label htmlFor="quick-command" className="sr-only">
        Ask Jody Core
      </label>
      <input
        id="quick-command"
        name="q"
        required
        maxLength={2000}
        placeholder="Ask Jody Core anything…"
        className="min-h-11 min-w-0 flex-1 bg-transparent text-base placeholder:text-subtle focus:outline-none"
      />
      <button type="submit" className={buttonClass("primary", "min-h-11 shrink-0 px-6")}>
        Ask <span aria-hidden="true">→</span>
      </button>
    </Form>
  );
}
