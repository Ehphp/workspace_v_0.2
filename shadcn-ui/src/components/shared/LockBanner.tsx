import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

interface LockBannerProps {
    status: 'DRAFT' | 'REVIEW' | 'LOCKED' | 'ACTIVE' | 'ARCHIVED';
    lockedBy?: string | null;
    lockedAt?: string | null;
}

export function LockBanner({ status, lockedBy, lockedAt }: LockBannerProps) {
    const { userRole } = useAuthStore();

    if (status !== 'LOCKED') return null;

    return (
        <Alert variant="destructive" className="mb-6 border-destructive/50 bg-destructive/10">
            <Lock className="h-4 w-4" />
            <AlertTitle>Project is Locked</AlertTitle>
            <AlertDescription className="flex flex-col gap-1">
                <span>
                    This project is currently locked. No changes can be made to requirements or estimations.
                </span>
                {userRole === 'admin' && (
                    <span className="text-xs font-medium mt-1">
                        As an Admin, you can unlock this project in the settings menu.
                    </span>
                )}
            </AlertDescription>
        </Alert>
    );
}
