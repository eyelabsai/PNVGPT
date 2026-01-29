# Content update workflow (V1 → expert-vetted)

All content in this folder is **V1** (initial draft). Updates are being vetted by an expert; once vetted, you paste the new text here and the assistant applies it. This doc keeps updates accurate and avoids dropping info.

## When you have expert-vetted text ready

**1. Tell the assistant exactly where it goes**

- **File:** e.g. `content/11-icl-faqs.md`
- **Section:** e.g. "What is EVO ICL?" or "## What are ICLs?" (the heading that contains the block you’re replacing)
- **Paste:** The exact expert-vetted text (no paraphrasing).

Example:

```
FILE: content/11-icl-faqs.md
SECTION: What is EVO ICL? / What are ICLs?

Replace the first paragraph (the EVO ICL description) with this expert-vetted text:

[paste expert text here]
```

**2. Say what to do with the rest**

- "Replace only that section; leave the rest of the file unchanged."
- Or: "Also update the recovery FAQ to match" (if the expert changed recovery details).

**3. Ask for a “dropped content” check**

Add:

> After you replace it, list any sentences or facts from the *original* section that are **not** in the expert text. I’ll decide whether to re-add them or leave them out.

The assistant will then:

- Replace only the specified section with your exact paste.
- List what from the original was removed (so you or the expert can confirm nothing important was dropped).

## What the assistant will do every time

1. **Replace only** the section you specified with the exact text you provided (no rewording).
2. **Leave all other sections** in that file unchanged unless you asked to update them.
3. **Report back:** "The following from the original was not in the expert text: [list]. Confirm if you want any of this re-added."

## Optional: keeping a bridge paragraph

If the expert only vetted the “what is EVO ICL?” paragraph and you have a follow-up paragraph (e.g. reversibility, LASIK alternatives), say:

- "Replace only the first paragraph with the expert text; keep the second paragraph as-is unless the expert said to remove it."

That way the assistant won’t delete the unvetted paragraph by mistake.

---

**Summary:** Specify file + section, paste exact expert text, ask for a “dropped content” list. The assistant replaces only that section and reports what was removed so you can verify nothing important is lost.
