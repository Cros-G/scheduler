import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  const user = await requireAuth();

  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const active = tasks.filter((t) => !t.archivedAt);
  const archived = tasks.filter((t) => !!t.archivedAt);

  return (
    <>
      <style>{`
        .tasks-root {
          max-width: 680px;
          margin: 0 auto;
          padding: 32px 24px 64px;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(22% 0.025 58);
        }

        .tasks-header {
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 1px solid oklch(88% 0.014 58);
          position: relative;
        }

        /* Subtle ruled-line texture behind header — echoes login page */
        .tasks-header::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 27px,
            oklch(88% 0.014 58 / 0.6) 27px,
            oklch(88% 0.014 58 / 0.6) 28px
          );
          pointer-events: none;
          border-radius: 4px;
        }

        .tasks-heading {
          position: relative;
          z-index: 1;
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.75rem;
          font-weight: 400;
          color: oklch(22% 0.025 58);
          letter-spacing: 0.08em;
          margin: 0 0 4px;
          line-height: 1.3;
        }

        .tasks-subtitle {
          position: relative;
          z-index: 1;
          font-size: 0.875rem;
          color: oklch(56% 0.018 58);
          margin: 0;
          letter-spacing: 0.03em;
        }
      `}</style>

      <div className="tasks-root">
        <div className="tasks-header">
          <h1 className="tasks-heading">我的任务</h1>
          <p className="tasks-subtitle">
            记录那些值得坚持的小事，每一次都算数
          </p>
        </div>

        <TasksClient active={active} archived={archived} />
      </div>
    </>
  );
}
