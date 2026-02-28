import { Command } from 'commander';
import chalk from 'chalk';
import { createDecisionLogService, createDecisionContextService } from '@repo/core';

// Create service instances
const decisionLogService = createDecisionLogService();
const decisionContextService = createDecisionContextService();

export const decisionCommand = new Command('decision')
  .description('Decision log commands');

// List decisions command
decisionCommand
  .command('list')
  .description('List decision logs')
  .option('-m, --meeting-id <id>', 'Filter by meeting ID')
  .option('-c, --context-id <id>', 'Filter by decision context ID')
  .option('-u, --user <user>', 'Filter by user who logged the decision')
  .action(async (options) => {
    try {
      let decisions;
      
      if (options.meetingId) {
        decisions = await decisionLogService.getMeetingDecisionLogs(options.meetingId);
      } else if (options.contextId) {
        decisions = await decisionLogService.getDecisionContextLogs(options.contextId);
      } else if (options.user) {
        decisions = await decisionLogService.getUserDecisionLogs(options.user);
      } else {
        console.error(chalk.red('Error: Must specify either --meeting-id, --context-id, or --user'));
        throw new Error('Must specify either --meeting-id, --context-id, or --user');
      }
      
      if (decisions.length === 0) {
        console.log(chalk.yellow('No decisions found'));
        return;
      }

      console.log(chalk.white('Decision Logs:'));
      console.log('');
      
      decisions.forEach((decision, index) => {
        console.log(chalk.gray(`${index + 1}. ${decision.id}`));
        console.log(chalk.white(`   Meeting: ${decision.meetingId}`));
        console.log(chalk.white(`   Context: ${decision.decisionContextId}`));
        console.log(chalk.white(`   Template: ${decision.templateId} (v${decision.templateVersion})`));
        console.log(chalk.white(`   Decision Method: ${JSON.stringify(decision.decisionMethod)}`));
        console.log(chalk.white(`   Logged By: ${decision.loggedBy}`));
        console.log(chalk.white(`   Logged At: ${decision.loggedAt}`));
        console.log(chalk.gray(`   Fields: ${JSON.stringify(decision.fields, null, 2)}`));
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Show decision command
decisionCommand
  .command('show <id>')
  .description('Show decision log details')
  .action(async (id) => {
    try {
      const decision = await decisionLogService.getDecisionLog(id);
      
      if (!decision) {
        console.error(chalk.red('Decision not found'));
        throw new Error('Decision not found');
      }

      console.log(chalk.white('Decision Log Details:'));
      console.log('');
      console.log(chalk.gray(`ID: ${decision.id}`));
      console.log(chalk.white(`Meeting ID: ${decision.meetingId}`));
      console.log(chalk.white(`Decision Context ID: ${decision.decisionContextId}`));
      console.log(chalk.white(`Template ID: ${decision.templateId}`));
      console.log(chalk.white(`Template Version: ${decision.templateVersion}`));
      console.log(chalk.white(`Decision Method: ${JSON.stringify(decision.decisionMethod, null, 2)}`));
      console.log(chalk.white(`Source Chunks: ${decision.sourceChunkIds.join(', ')}`));
      console.log(chalk.white(`Logged By: ${decision.loggedBy}`));
      console.log(chalk.white(`Logged At: ${decision.loggedAt}`));
      console.log('');
      console.log(chalk.white('Decision Fields:'));
      console.log(chalk.gray(JSON.stringify(decision.fields, null, 2)));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Statistics command
decisionCommand
  .command('stats')
  .description('Show decision statistics')
  .option('-m, --meeting-id <id>', 'Meeting ID to get statistics for')
  .action(async (options) => {
    try {
      if (!options.meetingId) {
        console.error(chalk.red('Error: --meeting-id is required'));
        throw new Error('--meeting-id is required');
      }

      const stats = await decisionLogService.getMeetingDecisionStats(options.meetingId);
      
      console.log(chalk.white('Decision Statistics:'));
      console.log('');
      console.log(chalk.gray(`Meeting ID: ${options.meetingId}`));
      console.log(chalk.white(`Total Decisions: ${stats.totalDecisions}`));
      console.log('');
      console.log(chalk.white('Decisions by Method:'));
      Object.entries(stats.decisionsByMethod).forEach(([method, count]) => {
        console.log(chalk.gray(`  ${method}: ${count}`));
      });
      console.log('');
      console.log(chalk.white('Decisions by User:'));
      Object.entries(stats.decisionsByUser).forEach(([user, count]) => {
        console.log(chalk.gray(`  ${user}: ${count}`));
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Add decision command
decisionCommand
  .command('add')
  .description('Log a new decision')
  .requiredOption('-c, --context-id <id>', 'Decision context ID')
  .option('-d, --method <method>', 'Decision method', 'manual')
  .option('-l, --logged-by <user>', 'User logging the decision', 'cli-user')
  .action(async (options) => {
    try {
      const decision = await decisionLogService.logDecision(
        options.contextId,
        {
          loggedBy: options.loggedBy,
          decisionMethod: options.method,
        }
      );

      if (!decision) {
        console.error(chalk.red('Failed to log decision'));
        throw new Error('Failed to log decision');
      }

      console.log(chalk.green('✓ Decision logged successfully'));
      console.log(chalk.white(`Decision ID: ${decision.id}`));
      console.log(chalk.white(`Meeting ID: ${decision.meetingId}`));
      console.log(chalk.white(`Context ID: ${decision.decisionContextId}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }
  });

// Context commands
decisionCommand
  .command('context')
  .description('Decision context management commands')
  .addCommand(
    new Command('create')
      .description('Create a new decision context')
      .requiredOption('-m, --meeting-id <id>', 'Meeting ID')
      .requiredOption('-f, --flagged-decision-id <id>', 'Flagged decision ID')
      .requiredOption('-t, --title <title>', 'Decision context title')
      .requiredOption('--template-id <id>', 'Decision template ID')
      .action(async (options) => {
        try {
          const context = await decisionContextService.createContext({
            meetingId: options.meetingId,
            flaggedDecisionId: options.flaggedDecisionId,
            title: options.title,
            templateId: options.templateId,
          });

          console.log(chalk.green('✓ Decision context created successfully'));
          console.log(chalk.white(`Context ID: ${context.id}`));
          console.log(chalk.white(`Title: ${context.title}`));
          console.log(chalk.white(`Status: ${context.status}`));
        } catch (error) {
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
          throw error;
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List decision contexts')
      .option('-m, --meeting-id <id>', 'Filter by meeting ID')
      .action(async (options) => {
        try {
          let contexts;
          
          if (options.meetingId) {
            contexts = await decisionContextService.getAllContextsForMeeting(options.meetingId);
          } else {
            console.error(chalk.red('Error: --meeting-id is required'));
            return;
          }

          if (!contexts || contexts.length === 0) {
            console.log(chalk.yellow('No decision contexts found'));
            return;
          }

          console.log(chalk.white('Decision Contexts:'));
          console.log('');
          
          contexts.forEach((context: any, index: number) => {
            console.log(chalk.gray(`${index + 1}. ${context.id}`));
            console.log(chalk.white(`   Title: ${context.title}`));
            console.log(chalk.white(`   Meeting: ${context.meetingId}`));
            console.log(chalk.white(`   Template: ${context.templateId}`));
            console.log(chalk.white(`   Status: ${context.status}`));
            console.log(chalk.white(`   Created: ${context.createdAt}`));
            console.log('');
          });
        } catch (error) {
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
          throw error;
        }
      })
  );
