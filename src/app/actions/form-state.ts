/** Result shape every form Server Action returns to useActionState. */
export type FormState =
  | {
      error?: string;
      message?: string;
      fieldErrors?: Record<string, string>;
      /** Non-secret inputs echoed back so the form can refill them after an error. */
      values?: Record<string, string>;
    }
  | undefined;
