import { WebWorkerSchema } from './schema';
import { SchematicContext, Tree, apply, mergeWith, applyTemplates, url, move, Rule, SchematicsException } from '@angular-devkit/schematics';
import { relativePathToWorkspaceRoot } from '@schematics/angular/utility/paths';
import { dirname, normalize } from 'path';
import * as jsoncparser from 'jsonc-parser';
