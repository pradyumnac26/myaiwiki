---
title: Obsidian Setup
feed: show
date: 2024-01-15
---

Here's how to set up Jekyll Garden to work seamlessly with Obsidian.

## Open the Project as Your Vault

For local preview and GitHub push from inside Obsidian, open the **whole Jekyll project** as your vault (not just `_notes`):

1. **Open Obsidian**
2. **Open folder as vault**
3. Choose: `/Users/pchippigiri/jekyll-garden.github.io`
4. Your notes still live in the `_notes/` folder inside the project

This gives Obsidian access to git, build scripts, and site preview tools.

## Front Matter Requirements

All notes must use the proper front matter format:

```yaml
---
title: "Your Note Title"
date: 2024-01-15
feed: "show"
---
```

The `feed: "show"` setting makes the note appear on your website. Use `feed: "hide"` for private notes.

## Git Ignore Setup

Add these folders to your `.gitignore` file:

```gitignore
# Obsidian settings
.obsidian/
.trash/

# Jekyll build files
_site/
.sass-cache/
.jekyll-cache/
```

## Private Notes

To keep some notes private (not published on your website):

1. **Create a folder** inside `_notes` (e.g., `_notes/Private/`)
2. **Add the folder to `.gitignore`**:
   ```gitignore
   _notes/Private/
   ```
3. **Set `feed: "hide"`** in the note's front matter

This way, private notes stay in your Obsidian vault but won't be synced to Git or built as pages in Jekyll.

## Preview the Site Inside Obsidian

Install these **Community plugins** (Settings → Community plugins → Browse):

1. **Shell commands** — run terminal commands from Obsidian
2. **Custom Frames** — embed the live site in a sidebar pane

Then configure them:

### Shell commands

Add two commands in Shell commands settings:

| Name | Shell command |
|------|---------------|
| Start site preview | `./scripts/serve.sh` |
| Push to GitHub | `./scripts/publish.sh "Update notes"` |

- Set both to run in the **vault root** (the Jekyll project folder).
- Assign hotkeys or add them to the command palette for quick access.

Start the preview first, then open the frame:

### Custom Frames

Add a new frame:

- **Name:** Site preview
- **URL:** `http://127.0.0.1:4000`
- Open it from the ribbon icon or command palette after Jekyll is running.

The site refreshes automatically when you save notes (Jekyll livereload).

## Push to GitHub from Obsidian

**Option A — Shell command (simplest)**

Run `./scripts/publish.sh "Your commit message"` from the command palette.

**Option B — Obsidian Git plugin**

1. Install **Obsidian Git** from Community plugins
2. Enable auto-pull on startup if you like
3. Use the Git pane to stage, commit, and push

Obsidian Git only works when your vault is the **project root** (see above), not the `_notes` subfolder alone.

## Workflow

1. **Write notes** in Obsidian under `_notes/`
2. **Use [[Wiki Links]]** to connect your notes
3. **Add proper front matter** to each note
4. **Run `./scripts/serve.sh`** and open the Custom Frame to preview
5. **Run `./scripts/publish.sh`** or use Obsidian Git to push to GitHub
6. **Your website updates** on GitHub Pages

## Tips

- **Keep Obsidian and Jekyll in sync**: The `_notes` folder is your single source of truth
- **Use descriptive titles**: They become your URLs and link targets
- **Test locally**: Run `bundle exec jekyll serve` to preview changes
- **Backup regularly**: Your notes are valuable - keep them safe

## External Resources

- [Obsidian Documentation](https://obsidian.md/help)
- [Jekyll Documentation](https://jekyllrb.com/docs/)
- [GitHub Pages](https://pages.github.com/)

---

*This setup gives you the best of both worlds: powerful note-taking in Obsidian and beautiful publishing with Jekyll Garden.* 