import { z } from "zod";

export const StageDefinitionSchema = z.object({
	name: z.string(),
	role: z.string(),
	model: z.string(),
	human_gate: z.boolean().default(false),
	context_reset: z.boolean().default(false),
	on_complete: z.array(z.string()).optional(),
});

export const WorkflowDefinitionSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	loop_on_changes: z.boolean().default(false),
	max_cycles: z.number().default(10),
	stages: z.array(StageDefinitionSchema).min(1),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type StageDefinition = z.infer<typeof StageDefinitionSchema>;
