import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { TechnologyPreset } from '@/types/database';
import { createList, fetchPresets } from '@/lib/api';
import { listSchema } from '@/lib/validation';
import { Layers, Sparkles, User, FileText, Cpu, Activity } from 'lucide-react';

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateListDialog({ open, onOpenChange, onSuccess }: CreateListDialogProps) {
  const { user, currentOrganization } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [techPresetId, setTechPresetId] = useState<string>('__NONE__');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>('DRAFT');
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<TechnologyPreset[]>([]);

  useEffect(() => {
    if (open) {
      loadPresets();
    }
  }, [open]);

  const loadPresets = async () => {
    try {
      const data = await fetchPresets();
      setPresets(data);
    } catch (error) {
      console.error('Error loading presets:', error);
      toast.error('Failed to load technologies');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrganization) return;

    setLoading(true);

    const parsed = listSchema.safeParse({
      name,
      description,
      owner: owner || user.email || '',
      techPresetId: techPresetId === '__NONE__' ? null : techPresetId,
      status,
    });

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Invalid data';
      toast.error('Invalid project data', { description: firstError });
      setLoading(false);
      return;
    }

    try {
      await createList({
        userId: user.id,
        organizationId: currentOrganization.id,
        ...parsed.data,
      });

      toast.success('Project created successfully');
      setName('');
      setDescription('');
      setOwner('');
      setTechPresetId('__NONE__');
      setStatus('DRAFT');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating list:', error);
      toast.error('Failed to create project');
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-4 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent font-bold">
                Create New Project
              </span>
            </DialogTitle>
            <DialogDescription className="pt-1">
              Create a new project to organize your requirements and estimations.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-slate-700 font-medium flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sprint Q4 - HR Module"
                className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="text-slate-700 font-medium flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this project..."
                className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="owner" className="text-slate-700 font-medium flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Owner
                </Label>
                <Input
                  id="owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder={user?.email || 'Project owner'}
                  className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status" className="text-slate-700 font-medium flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  Status
                </Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="techPreset" className="text-slate-700 font-medium flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                Default Technology
              </Label>
              <Select value={techPresetId} onValueChange={setTechPresetId}>
                <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all">
                  <SelectValue placeholder="Select technology" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">None (set per requirement)</SelectItem>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500">
                All requirements in this project will inherit this technology by default
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="hover:bg-slate-100">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
