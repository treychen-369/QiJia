'use client';

/**
 * 家庭档案对话框
 * Phase 5: 从侧边栏触发的家庭档案编辑
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FamilyProfileForm } from '@/components/allocation/family-profile-form';
import { Users } from 'lucide-react';

interface FamilyProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function FamilyProfileDialog({ 
  open, 
  onOpenChange,
  onSave 
}: FamilyProfileDialogProps) {
  const handleSave = () => {
    onSave?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            家庭档案
          </DialogTitle>
          <DialogDescription>
            设置家庭收支、风险偏好等信息，用于生成更精准的配置建议
          </DialogDescription>
        </DialogHeader>

        <FamilyProfileForm onSave={handleSave} />
      </DialogContent>
    </Dialog>
  );
}
