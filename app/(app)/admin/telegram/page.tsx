import type { Metadata } from "next";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getMe, getWebhookInfo } from "@/lib/telegram/client";
import { registerWebhook, unlinkGroup } from "./actions";

export const metadata: Metadata = { title: "Telegram" };

export default async function TelegramPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [bot, webhook, settings, people] = await Promise.all([
    getMe(),
    getWebhookInfo(),
    createAdminClient()
      .from("app_settings")
      .select("telegram_chat_id, telegram_chat_title")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, telegram_user_id, telegram_name")
      .eq("active", true)
      .order("full_name"),
  ]);

  const expectedUrl = `${appUrl()}/api/telegram/webhook`;
  const webhookConnected = webhook.ok && webhook.result.url === expectedUrl;
  const groupLinked = Boolean(settings.data?.telegram_chat_id);
  const linkedPeople = (people.data ?? []).filter((person) => person.telegram_user_id);
  const unlinkedPeople = (people.data ?? []).filter((person) => !person.telegram_user_id);
  const botHandle = bot.ok ? `@${bot.result.username}` : "the bot";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-ink">Telegram</h1>
        <p className="text-body text-ink-soft">
          The bot posts new services, upload reminders and handoffs in the
          team&apos;s group. Three things need setting up, once.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-title-lg text-ink">1. The bot</h2>
          {bot.ok ? (
            <Badge tone="success">{botHandle}</Badge>
          ) : (
            <Badge tone="danger">Not set up</Badge>
          )}
        </div>
        {bot.ok ? (
          <p className="text-body-sm text-muted">
            The app can reach {botHandle}.
          </p>
        ) : (
          <p className="text-body-sm text-danger">
            {bot.reason === "not_configured"
              ? "TELEGRAM_BOT_TOKEN is not set on the server. Add the token from BotFather to the environment variables and redeploy."
              : `Telegram did not accept the bot token: ${bot.description}`}
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-title-lg text-ink">2. Message delivery</h2>
          {webhookConnected ? (
            <Badge tone="success">Connected</Badge>
          ) : (
            <Badge tone="warning">Not connected</Badge>
          )}
        </div>
        <p className="text-body-sm text-muted">
          {webhookConnected
            ? "Telegram is delivering the bot's messages to this app."
            : "Telegram needs to be told to deliver the bot's messages to this app. Do this on the live site."}
        </p>
        {webhook.ok && webhook.result.last_error_message ? (
          <p className="text-body-sm text-danger">
            Telegram&apos;s last delivery error: {webhook.result.last_error_message}
          </p>
        ) : null}
        {bot.ok ? (
          <ActionButton
            action={registerWebhook}
            fields={{}}
            label={webhookConnected ? "Reconnect" : "Connect"}
            pendingLabel="Connecting…"
            variant={webhookConnected ? "secondary" : "primary"}
            size="md"
            className="self-start"
          />
        ) : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-title-lg text-ink">3. The team group</h2>
          {groupLinked ? (
            <Badge tone="success">{settings.data?.telegram_chat_title ?? "Linked"}</Badge>
          ) : (
            <Badge tone="warning">Not linked</Badge>
          )}
        </div>
        {groupLinked ? (
          <>
            <p className="text-body-sm text-muted">
              The bot posts in this group. To move to another group, send{" "}
              <code className="font-mono">/linkgroup</code> there.
            </p>
            <ActionButton
              action={unlinkGroup}
              fields={{}}
              label="Unlink group"
              variant="danger"
              className="self-start"
              confirmMessage="Stop the bot posting in this group?"
            />
          </>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-body-sm text-ink-soft">
            <li>Add {botHandle} to the media team&apos;s Telegram group.</li>
            <li>
              In the group, send <code className="font-mono">/linkgroup</code>.
            </li>
            <li>Open the link the bot replies with and confirm.</li>
          </ol>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-title-lg text-ink">
          Who the bot can tag ({linkedPeople.length} of {people.data?.length ?? 0})
        </h2>
        <p className="text-body-sm text-muted">
          Each person sends <code className="font-mono">/join</code> to{" "}
          {botHandle} in a private chat and opens the link it replies with.
          People who have not are named in messages but not notified.
        </p>
        <ul className="divide-y divide-hairline-soft">
          {[...linkedPeople, ...unlinkedPeople].map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span className="text-body text-ink">{person.full_name}</span>
              {person.telegram_user_id ? (
                <Badge tone="success">{person.telegram_name ?? "Connected"}</Badge>
              ) : (
                <Badge>Not connected</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
