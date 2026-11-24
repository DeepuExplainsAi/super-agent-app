export interface Role {
  name: string;
  /** What this role is for; becomes its system prompt. */
  instructions: string;
}

export type Say = (system: string, transcript: string) => Promise<string>;

export interface TeamResult {
  answer: string;
  transcript: { role: string; text: string }[];
}

/**
 * A team chat (AutoGen / CrewAI style): the roles take turns on one shared transcript for `rounds` rounds,
 * then the lead reads everything and writes the final answer. `say` is any model call (the failover chain in the app).
 */
export async function runTeam(options: { task: string; roles: Role[]; lead: Role; say: Say; rounds?: number }): Promise<TeamResult> {
  const { task, roles, lead, say } = options;
  if (!roles.length) throw new Error("A team needs at least one role.");
  const rounds = Math.min(Math.max(options.rounds ?? 1, 1), 5);
  const transcript: TeamResult["transcript"] = [];
  const render = () => [`Task: ${task}`, ...transcript.map((turn) => `${turn.role}: ${turn.text}`)].join("\n\n");

  for (let round = 0; round < rounds; round++) {
    for (const role of roles) {
      const text = await say(`You are ${role.name}. ${role.instructions}\nAnswer with your contribution only.`, render());
      transcript.push({ role: role.name, text });
    }
  }
  const answer = await say(`You are ${lead.name}. ${lead.instructions}\nRead the team's discussion and write the final answer.`, render());
  return { answer, transcript };
}
