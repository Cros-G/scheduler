import { requireAuth } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await requireAuth();

  return (
    <>
      <style>{`
        .settings-root {
          max-width: 680px;
          margin: 0 auto;
          padding: 32px 24px 64px;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(22% 0.025 58);
        }

        .settings-header {
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 1px solid oklch(88% 0.014 58);
          position: relative;
        }

        .settings-header::before {
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

        .settings-heading {
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

        .settings-subtitle {
          position: relative;
          z-index: 1;
          font-size: 0.875rem;
          color: oklch(56% 0.018 58);
          margin: 0;
          letter-spacing: 0.03em;
        }
      `}</style>

      <div className="settings-root">
        <div className="settings-header">
          <h1 className="settings-heading">个人设置</h1>
          <p className="settings-subtitle">
            修改昵称与颜色，让圈友认出你
          </p>
        </div>

        <SettingsForm
          username={user.username}
          initialDisplayName={user.displayName}
          initialColor={user.color}
        />
      </div>
    </>
  );
}
