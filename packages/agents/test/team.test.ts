import { describe, expect, it } from "vitest";
import { runTeam } from "../src/index.ts";

describe("runTeam", () => {
  it("lets each role see earlier turns, then the lead writes the answer", async () => {
    const calls: { system: string; transcript: string }[] = [];
    const say = async (system: string, transcript: string) => (calls.push({ system, transcript }), `reply${calls.length}`);
    const result = await runTeam({
      task: "Plan a trip",
      roles: [{ name: "Researcher", instructions: "Find facts." }, { name: "Critic", instructions: "Find problems." }],
      lead: { name: "Lead", instructions: "Decide." },
      say,
    });
    expect(result.transcript).toEqual([{ role: "Researcher", text: "reply1" }, { role: "Critic", text: "reply2" }]);
    expect(calls[1]!.transcript).toContain("Researcher: reply1");
    expect(calls[2]!.system).toContain("You are Lead");
    expect(calls[2]!.transcript).toContain("Critic: reply2");
    expect(result.answer).toBe("reply3");
  });

  it("caps rounds at 5 and rejects an empty team", async () => {
    let n = 0;
    const say = async () => `${++n}`;
    const out = await runTeam({ task: "t", roles: [{ name: "A", instructions: "" }], lead: { name: "L", instructions: "" }, say, rounds: 99 });
    expect(out.transcript).toHaveLength(5);
    await expect(runTeam({ task: "t", roles: [], lead: { name: "L", instructions: "" }, say })).rejects.toThrow("at least one role");
  });
});
