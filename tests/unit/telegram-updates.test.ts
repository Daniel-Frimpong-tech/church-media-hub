import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/telegram/updates";

const update = (text: string, overrides: Record<string, unknown> = {}) => ({
  update_id: 1,
  message: {
    message_id: 10,
    text,
    chat: { id: 555, type: "private" },
    from: { id: 42, is_bot: false, first_name: "Grace", last_name: "Mensah" },
    ...overrides,
  },
});

describe("parseCommand", () => {
  it("reads a command sent in a private chat", () => {
    expect(parseCommand(update("/join"))).toEqual({
      command: "join",
      chatId: 555,
      chatType: "private",
      chatTitle: null,
      messageId: 10,
      fromId: 42,
      fromName: "Grace Mensah",
    });
  });

  it("reads a command addressed to the bot in a group", () => {
    const command = parseCommand(
      update("/linkgroup@rcw_media_bot", {
        chat: { id: -100123, type: "supergroup", title: "RCW Media Team" },
      }),
    );
    expect(command).toMatchObject({
      command: "linkgroup",
      chatId: -100123,
      chatType: "supergroup",
      chatTitle: "RCW Media Team",
    });
  });

  it("ignores case and trailing words", () => {
    expect(parseCommand(update("/JOIN please"))?.command).toBe("join");
  });

  it.each(["hello", "join", " /join", "see /join", ""])(
    "ignores ordinary message %j",
    (text) => {
      expect(parseCommand(update(text))).toBeNull();
    },
  );

  it("ignores other bots", () => {
    expect(
      parseCommand(update("/join", { from: { id: 9, is_bot: true, first_name: "Bot" } })),
    ).toBeNull();
  });

  it.each([null, "text", 42, [], {}, { message: null }, { message: { text: "/join" } }])(
    "ignores malformed payload %j",
    (payload) => {
      expect(parseCommand(payload)).toBeNull();
    },
  );

  it("ignores updates that are not new messages", () => {
    expect(parseCommand({ update_id: 1, edited_message: update("/join").message })).toBeNull();
  });
});
