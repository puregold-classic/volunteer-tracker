// v3.2 — account self-service modal: change password + upload avatar.
// Used from MePage next to the logout button.

import { useRef, useState } from 'react';
import { Camera, KeyRound, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

const FieldLabel: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
    {children}
  </label>
);
import authService from '@services/authService';
import { useAuth } from '@/context/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volunteerId?: string;
  currentAvatar?: string;
  onAvatarChanged?: (newAvatar: string) => void;
}

// Resize + re-encode as JPEG. Keeps payload well under the 512KB server cap
// regardless of what the user picks.
async function resizeImage(file: File, maxDim = 512, quality = 0.85): Promise<string> {
  const reader = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = reader;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export const AccountSettingsDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  currentAvatar,
  onAvatarChanged,
}) => {
  const { logout } = useAuth();
  const [tab, setTab] = useState<'password' | 'avatar'>('avatar');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetPwForm = () => {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw) {
      toast({ title: '请填写当前密码和新密码', variant: 'destructive' });
      return;
    }
    if (newPw.length < 8) {
      toast({ title: '新密码长度至少 8 位', variant: 'destructive' });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: '两次新密码不一致', variant: 'destructive' });
      return;
    }
    setPwBusy(true);
    try {
      const res = await authService.changePassword(currentPw, newPw);
      if (!res?.success) {
        toast({ title: res?.error || '修改密码失败', variant: 'destructive' });
        return;
      }
      toast({ title: '密码已更新', description: '正在重新登录…' });
      resetPwForm();
      onOpenChange(false);
      await logout();
    } finally {
      setPwBusy(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: '仅支持图片文件', variant: 'destructive' });
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      setPreviewAvatar(dataUrl);
    } catch (err) {
      toast({ title: '图片处理失败', description: String((err as Error).message), variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadAvatar = async () => {
    if (!previewAvatar) return;
    setAvatarBusy(true);
    try {
      const res = await authService.updateAvatar(previewAvatar);
      if (!res?.success) {
        toast({ title: res?.error || '更新头像失败', variant: 'destructive' });
        return;
      }
      toast({ title: '头像已更新' });
      onAvatarChanged?.(previewAvatar);
      setPreviewAvatar(null);
      onOpenChange(false);
    } finally {
      setAvatarBusy(false);
    }
  };

  const shownAvatar = previewAvatar || currentAvatar;
  const hasCustomAvatar = shownAvatar && !shownAvatar.includes('ui-avatars.com');

  return (
    <Dialog open={open} onOpenChange={onOpenChange} closeOnOutsideClick={false} title="账号设置" description="修改密码或更换头像">
      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={tab === 'avatar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('avatar')}
            className="flex-1"
          >
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            头像
          </Button>
          <Button
            type="button"
            variant={tab === 'password' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('password')}
            className="flex-1"
          >
            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
            修改密码
          </Button>
        </div>

        {tab === 'avatar' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              {hasCustomAvatar ? (
                <img
                  src={shownAvatar}
                  alt="avatar preview"
                  className="h-32 w-32 rounded-2xl object-cover ring-2 ring-border"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-muted text-xs text-muted-foreground ring-2 ring-border">
                  暂无自定义头像
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                选择图片
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                图片会压缩到 512px 以内再上传，单张最大约 500KB
              </p>
            </div>
            {previewAvatar && (
              <Button type="button" className="w-full" onClick={handleUploadAvatar} disabled={avatarBusy}>
                {avatarBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认上传
              </Button>
            )}
          </div>
        )}

        {tab === 'password' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <FieldLabel htmlFor="currentPw">当前密码</FieldLabel>
              <Input
                id="currentPw"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="newPw">新密码（≥8 位）</FieldLabel>
              <Input
                id="newPw"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="confirmPw">确认新密码</FieldLabel>
              <Input
                id="confirmPw"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">改密后所有会话会登出，需要用新密码重新登录。</p>
            <Button type="button" className="w-full" onClick={handleChangePassword} disabled={pwBusy}>
              {pwBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              更新密码
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default AccountSettingsDialog;
