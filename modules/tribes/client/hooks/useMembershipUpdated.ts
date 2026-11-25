import { useAuth, type AuthUser } from '@trustroots/core/auth';

/** Copies a joined or left circle's member changes into the signed-in member. */
export default function useMembershipUpdated() {
  const { user, setUser } = useAuth();
  return (data: { user?: Partial<NonNullable<AuthUser>> } | null) => {
    /* istanbul ignore else -- malformed membership callbacks cannot update auth state. */
    if (data?.user) {
      setUser({ ...user, ...data.user, roles: user?.roles });
    }
  };
}
