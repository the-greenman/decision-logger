/**
 * Drizzle Implementation of Decision Template Repository
 */
import { type TemplateFieldAssignmentInsert } from '../schema.js';
import type { DecisionTemplate, CreateDecisionTemplate, TemplateFieldAssignment } from '@repo/schema';
type DecisionTemplateIdentityLookup = {
    namespace?: string;
    name: string;
    version?: number;
};
interface IDecisionTemplateRepository {
    create(data: CreateDecisionTemplate): Promise<DecisionTemplate>;
    findById(id: string): Promise<DecisionTemplate | null>;
    findByIdentity(identity: DecisionTemplateIdentityLookup): Promise<DecisionTemplate | null>;
    findAll(): Promise<DecisionTemplate[]>;
    findByCategory(category: string): Promise<DecisionTemplate[]>;
    findDefault(): Promise<DecisionTemplate | null>;
    update(id: string, data: Partial<CreateDecisionTemplate>): Promise<DecisionTemplate | null>;
    delete(id: string): Promise<boolean>;
    setDefault(id: string): Promise<DecisionTemplate>;
    search(query: string): Promise<DecisionTemplate[]>;
}
interface ITemplateFieldAssignmentRepository {
    create(data: TemplateFieldAssignmentInsert): Promise<TemplateFieldAssignment>;
    createMany(data: TemplateFieldAssignmentInsert[]): Promise<TemplateFieldAssignment[]>;
    findByTemplate(templateId: string): Promise<TemplateFieldAssignment[]>;
    findByField(fieldId: string): Promise<TemplateFieldAssignment[]>;
    update(templateId: string, fieldId: string, data: Partial<TemplateFieldAssignmentInsert>): Promise<TemplateFieldAssignment | null>;
    delete(templateId: string, fieldId: string): Promise<boolean>;
    deleteByTemplate(templateId: string): Promise<boolean>;
}
export declare class DrizzleDecisionTemplateRepository implements IDecisionTemplateRepository {
    private mapToSchema;
    private mapFieldAssignmentToSchema;
    create(data: CreateDecisionTemplate): Promise<DecisionTemplate>;
    findById(id: string): Promise<DecisionTemplate | null>;
    findByIdentity(identity: DecisionTemplateIdentityLookup): Promise<DecisionTemplate | null>;
    findAll(): Promise<DecisionTemplate[]>;
    findDefault(): Promise<DecisionTemplate | null>;
    setDefault(id: string): Promise<DecisionTemplate>;
    update(id: string, data: Partial<CreateDecisionTemplate>): Promise<DecisionTemplate | null>;
    delete(id: string): Promise<boolean>;
    findByCategory(category: string): Promise<DecisionTemplate[]>;
    findByName(name: string): Promise<DecisionTemplate | null>;
    search(query: string): Promise<DecisionTemplate[]>;
    createMany(templates: CreateDecisionTemplate[]): Promise<DecisionTemplate[]>;
}
export declare class DrizzleTemplateFieldAssignmentRepository implements ITemplateFieldAssignmentRepository {
    private mapFieldAssignmentToSchema;
    create(data: TemplateFieldAssignmentInsert): Promise<TemplateFieldAssignment>;
    findByTemplateId(templateId: string): Promise<TemplateFieldAssignment[]>;
    findByTemplate(templateId: string): Promise<TemplateFieldAssignment[]>;
    findByFieldId(fieldId: string): Promise<TemplateFieldAssignment[]>;
    findByField(fieldId: string): Promise<TemplateFieldAssignment[]>;
    update(templateId: string, fieldId: string, data: Partial<TemplateFieldAssignmentInsert>): Promise<TemplateFieldAssignment | null>;
    delete(templateId: string, fieldId: string): Promise<boolean>;
    deleteByTemplateId(templateId: string): Promise<boolean>;
    deleteByTemplate(templateId: string): Promise<boolean>;
    createMany(assignments: TemplateFieldAssignmentInsert[]): Promise<TemplateFieldAssignment[]>;
    updateOrder(templateId: string, assignments: {
        fieldId: string;
        order: number;
    }[]): Promise<void>;
}
export {};
