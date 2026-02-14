# UI/UX System Prompt for OpenClaw (shadcn + Tailwind)

Paste this into your system prompt or project instructions:

---

## UI & Component Design Rules

You are building a professional web application. Follow these rules for ALL UI work:

### Modal Design
- Modals must have a **clear visual hierarchy**: header → tabs/nav → body → footer
- Header: badge/type indicator + inline-editable title + close button. No giant headings.
- Body: use `space-y-5` or `space-y-6` for vertical rhythm. Never cram fields together.
- Footer: sticky bottom bar with Cancel + primary action button. Always right-aligned actions.
- Max width: `max-w-2xl` for detail modals. Use `max-h-[60vh] overflow-y-auto` for scrollable body.
- Backdrop: `bg-black/60 backdrop-blur-sm` with fade-in animation.

### Form Layout
- Group related fields in `grid grid-cols-2` or `grid-cols-3` rows with `gap-4`.
- Labels: `text-xs font-medium uppercase tracking-wider text-muted-foreground` above each field.
- Inputs/selects/textareas: consistent border radius (`rounded-lg`), padding (`px-3 py-2`), and focus ring.
- Separate logical sections with a subtle `border-t border-border/30` divider — NOT bold section headers like "DETAILS" or "METADATA".
- Metadata (created/updated dates, IDs) goes at the bottom as de-emphasized inline text (`text-xs text-muted-foreground`), never as a loud section.

### Visual Hierarchy Rules
- Only ONE prominent element per view (the title or primary content).
- Section labels should be subtle, not screaming. Never use all-caps bold colored section headers like "BASIC INFORMATION" or "DETAILS".
- Use badges (`rounded-md px-2 py-0.5 text-xs`) for type/status/priority — not raw text.
- Priority badges should be color-coded: P0=red, P1=orange, P2=yellow, P3=slate.

### Spacing & Padding
- Modal padding: `px-6 py-5` for body content.
- Never use less than `gap-3` between form fields.
- Use `space-y-5` for vertical sections, not `space-y-2`.
- Give inputs breathing room — min `py-2` padding inside all form controls.

### shadcn/ui Usage
- Use shadcn Dialog, Select, Input, Textarea, Badge, Button, Tabs components.
- Do NOT override shadcn components with custom wrappers that break their styling.
- If shadcn's default styling is insufficient, extend with Tailwind classes — don't fight the component library.
- Use `<DialogHeader>`, `<DialogFooter>` correctly for proper layout.
- Prefer `<Tabs>` with `<TabsList>` + `<TabsTrigger>` for modal sections instead of custom section headers.

### Anti-Patterns to AVOID
- ❌ Multiple competing bold section headers ("BASIC INFORMATION", "DETAILS", "METADATA")
- ❌ Full-width single-column forms when fields could be in a grid
- ❌ Placeholder text styling that's the same weight/color as actual content
- ❌ Cramped spacing with no visual breathing room
- ❌ Raw monospace text for everything
- ❌ Dropdowns/selects that span the full width when they only need 150px of content
- ❌ Metadata displayed with the same prominence as editable fields
- ❌ Missing backdrop blur or animation on modals
- ❌ No clear call-to-action / save button

---

## Design Patterns & Examples

### Priority Badge Color Codes
Use these exact color codes for priority indicators:
- **P0 (Critical):** `bg-red-500 text-white` — Urgent, blocks work
- **P1 (High):** `bg-orange-500 text-white` — Important, schedule soon
- **P2 (Medium):** `bg-yellow-500 text-black` — Standard priority
- **P3 (Low):** `bg-slate-400 text-white` — Nice to have, backlog

Example badge component:
```tsx
<Badge className={`${
  priority === 'P0' ? 'bg-red-500' :
  priority === 'P1' ? 'bg-orange-500' :
  priority === 'P2' ? 'bg-yellow-500' :
  'bg-slate-400'
} text-white`}>
  {priority}
</Badge>
```

### TaskModal Pattern (Redesigned)
The TaskModal demonstrates proper modal design:
- Header with inline-editable title and priority badge
- Body with tab-based sections (Details, Assignments, Notes)
- Footer with Cancel and Save buttons (sticky bottom)
- Proper spacing with `space-y-5` between sections
- Form fields grouped in grid layout with `gap-4`

```tsx
<Dialog>
  <DialogHeader className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Badge>P1</Badge>
      <input 
        defaultValue={task.title} 
        className="text-lg font-semibold"
      />
    </div>
    <DialogClose />
  </DialogHeader>
  
  <Tabs defaultValue="details" className="space-y-5">
    <TabsList>
      <TabsTrigger value="details">Details</TabsTrigger>
      <TabsTrigger value="assignments">Assignments</TabsTrigger>
      <TabsTrigger value="notes">Notes</TabsTrigger>
    </TabsList>
    
    <TabsContent value="details" className="space-y-5">
      {/* Form fields in grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium uppercase">Status</label>
          <Select defaultValue={task.status}>
            <SelectContent>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="development">Development</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </TabsContent>
  </Tabs>
  
  <DialogFooter>
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </DialogFooter>
</Dialog>
```

### TaskListModal Pattern (Redesigned)
The TaskListModal shows proper list presentation:
- Subtle row dividers with `border-t border-border/30`
- Task rows with badge + title + metadata
- No competing section headers
- Metadata at the bottom in small, muted text

```tsx
<Dialog>
  <DialogHeader>
    <span>Active Tasks</span>
    <Badge className="ml-2">12</Badge>
  </DialogHeader>
  
  <div className="space-y-1">
    {tasks.map((task) => (
      <div 
        key={task.id} 
        className="border-t border-border/30 py-3 px-3 hover:bg-accent cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Badge className="w-fit">P{task.priority}</Badge>
          <span className="font-medium">{task.title}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Owner: {task.owner} • Created: {task.createdAt}
        </div>
      </div>
    ))}
  </div>
</Dialog>
```

### Form Field Groups
Group related fields with proper spacing and visual hierarchy:

```tsx
<div className="space-y-5">
  {/* Section 1: Basic Info */}
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Title
      </label>
      <Input placeholder="Enter title" className="mt-2" />
    </div>
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Priority
      </label>
      <Select>
        <SelectContent>
          <SelectItem value="P0">P0 - Critical</SelectItem>
          <SelectItem value="P1">P1 - High</SelectItem>
          <SelectItem value="P2">P2 - Medium</SelectItem>
          <SelectItem value="P3">P3 - Low</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
  
  {/* Divider */}
  <div className="border-t border-border/30" />
  
  {/* Section 2: Details */}
  <div>
    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      Description
    </label>
    <Textarea placeholder="Add details..." className="mt-2" />
  </div>
  
  {/* Metadata at bottom */}
  <div className="border-t border-border/30 pt-3 text-xs text-muted-foreground">
    <div>Created: 2026-02-14 09:00 UTC</div>
    <div>Last updated: 2026-02-14 09:30 UTC</div>
    <div>ID: task-78451384ee3db</div>
  </div>
</div>
```

---

## Implementation Checklist

When building UI components, verify:
- [ ] Clear visual hierarchy (one prominent element per view)
- [ ] Proper modal structure (header → body → footer)
- [ ] Form fields in grid layout with consistent gap
- [ ] Priority badges using correct color codes
- [ ] Metadata de-emphasized at bottom
- [ ] No competing section headers
- [ ] Proper spacing with `space-y-5` or `space-y-6`
- [ ] shadcn/ui components used correctly
- [ ] Backdrop blur and animations on modals
- [ ] Accessibility labels and focus states
