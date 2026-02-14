import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Commit {
  sha: string
  message: string
  date: string
}

interface GitHubPanelProps {
  taskId: string
  githubIssueUrl?: string
  commits?: Commit[]
  onCreateIssue?: (taskId: string, title: string, description: string) => Promise<string>
  isLoading?: boolean
}

export function GitHubPanel({
  taskId,
  githubIssueUrl,
  commits = [],
  onCreateIssue,
  isLoading = false,
}: GitHubPanelProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateIssue = async () => {
    if (!issueTitle.trim()) {
      alert('Issue title is required')
      return
    }

    try {
      setCreating(true)
      const url = await onCreateIssue?.(taskId, issueTitle, issueDescription)
      if (url) {
        setIssueTitle('')
        setIssueDescription('')
        setShowCreateDialog(false)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create issue')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">GitHub Integration</h3>
        <Button
          onClick={() => setShowCreateDialog(true)}
          disabled={isLoading || creating}
          size="sm"
          variant="outline"
        >
          🐙 Create Issue
        </Button>
      </div>

      {githubIssueUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-800">Linked Issue</Badge>
            <a
              href={githubIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm truncate"
            >
              {githubIssueUrl}
            </a>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No GitHub issue linked yet</p>
      )}

      {commits && commits.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Linked Commits</h4>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Commit</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-32">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commits.map((commit) => (
                  <TableRow key={commit.sha}>
                    <TableCell className="text-xs font-mono">
                      <a
                        href={`https://github.com/search?q=${commit.sha}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {commit.sha.substring(0, 7)}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm">{commit.message}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(commit.date).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create GitHub Issue</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">
                Issue Title *
              </label>
              <Input
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                placeholder="Describe the issue..."
                disabled={creating}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">
                Description
              </label>
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Optional issue details..."
                className="w-full p-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                rows={4}
                disabled={creating}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateIssue}
              disabled={creating || !issueTitle.trim()}
            >
              {creating ? 'Creating...' : 'Create Issue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
