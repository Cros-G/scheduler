import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateUserForm } from "./create-user-form";
import { AdminUserTable } from "./admin-user-table";

export const metadata = {
  title: "管理员控制台",
};

export default async function AdminPage() {
  const currentUser = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ isAdmin: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      color: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  return (
    <>
      <style>{`
        .admin-root {
          max-width: 900px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(22% 0.025 58);
        }

        /* ── Page header ───────────────────────────────────────────── */
        .admin-header {
          margin-bottom: 36px;
          padding-bottom: 20px;
          border-bottom: 1px solid oklch(88% 0.014 58);
          position: relative;
        }

        .admin-header::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 27px,
            oklch(88% 0.014 58 / 0.5) 27px,
            oklch(88% 0.014 58 / 0.5) 28px
          );
          pointer-events: none;
          border-radius: 4px;
        }

        .admin-heading {
          position: relative;
          z-index: 1;
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.75rem;
          font-weight: 400;
          color: oklch(22% 0.025 58);
          letter-spacing: 0.08em;
          margin: 0 0 6px;
          line-height: 1.3;
        }

        .admin-subtitle {
          position: relative;
          z-index: 1;
          font-size: 0.875rem;
          color: oklch(54% 0.018 58);
          margin: 0;
          letter-spacing: 0.03em;
          line-height: 1.6;
          max-width: 60ch;
        }

        /* ── Section labels ────────────────────────────────────────── */
        .admin-section {
          margin-bottom: 40px;
        }

        .admin-section-heading {
          font-size: 0.75rem;
          font-weight: 600;
          color: oklch(52% 0.018 58);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 14px;
        }

        /* User count summary */
        .admin-count {
          font-size: 0.8125rem;
          color: oklch(58% 0.016 58);
          margin-bottom: 12px;
          letter-spacing: 0.02em;
        }

        @media (max-width: 600px) {
          .admin-root {
            padding: 20px 14px 60px;
          }
          .admin-heading {
            font-size: 1.4375rem;
          }
        }
      `}</style>

      <div className="admin-root">
        {/* Page heading */}
        <div className="admin-header">
          <h1 className="admin-heading">管理员控制台</h1>
          <p className="admin-subtitle">
            这里管理所有账号。请谨慎操作 —— 删除账号会一并删除其所有数据。
          </p>
        </div>

        {/* Create user section */}
        <section className="admin-section" aria-labelledby="create-heading">
          <p className="admin-section-heading" id="create-heading">新建账号</p>
          <CreateUserForm />
        </section>

        {/* User list section */}
        <section aria-labelledby="list-heading">
          <p className="admin-section-heading" id="list-heading">用户列表</p>
          <p className="admin-count">共 {users.length} 个账号</p>
          <AdminUserTable users={users} currentUserId={currentUser.id} />
        </section>
      </div>
    </>
  );
}
