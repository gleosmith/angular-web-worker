import { dirname, join, normalize, strings } from '@angular-devkit/core';
import * as jsoncparser from 'jsonc-parser';
import {
  Rule, SchematicContext, SchematicsException, Tree,
  apply, applyTemplates, chain, mergeWith, move, noop, url,
} from '@angular-devkit/schematics';
import { parseName } from '@schematics/angular/utility/parse-name';
import { relativePathToWorkspaceRoot } from '@schematics/angular/utility/paths';
import { buildDefaultPath, getWorkspace, updateWorkspace } from '@schematics/angular/utility/workspace';
import { BrowserBuilderOptions } from '@schematics/angular/utility/workspace-models';
import { WebWorkerSchema } from './schema';

// modified from '@schematics/angular/web-worker'
export function addConfig(options: WebWorkerSchema, root: string): Rule {
  return (tree: Tree, context: SchematicContext) => {
      return mergeWith(
          apply(url('./files/ts-config'), [
              applyTemplates({
                  ...options,
                  relativePathToWorkspaceRoot: relativePathToWorkspaceRoot(root),
              }),
              move(root),
          ]),
      );
  };
}

export function checkForTsConfigWorkerExclusion(tree: Tree, tsConfigPath: string): void {

  const isInSrc = dirname(normalize(tsConfigPath)).endsWith('src');
  const workerGlob = `${isInSrc ? '' : 'src/'}**/*.worker.ts`;

  const buffer = tree.read(tsConfigPath);

  if (buffer) {
      const treeNode = jsoncparser.parseTree(buffer.toString());
      if (!treeNode || treeNode.type !== 'object') {
          throw new SchematicsException('Invalid tsconfig. Was expecting an object');
      }
      const filesAstNode = jsoncparser.findNodeAtLocation(treeNode, ['compilerOptions', 'exclude']);
      if (filesAstNode && filesAstNode.type !== 'array') {
          throw new SchematicsException('Invalid tsconfig "exclude" property; expected an array.');
      }

      if (filesAstNode) {
          if ((<string[]>filesAstNode.value).includes(workerGlob)) {
              throw new SchematicsException(`Invalid tsconfig, cannot exclude ${workerGlob} in ${tsConfigPath}`);
          }
      }
  }
}

// code adapted from '@schematics/angular/web-worker'
export default function (options: WebWorkerSchema): Rule {
  return async (tree: Tree) => {
    const workspace = await getWorkspace(tree);

    if (!options.project) {
      throw new SchematicsException('Option "project" is required.');
    }

    if (!options.target) {
      throw new SchematicsException('Option "target" is required.');
    }

    const project = workspace.projects.get(options.project);
    if (!project) {
      throw new SchematicsException(`Invalid project name (${options.project})`);
    }
    const projectType = project.extensions['projectType'];
    if (projectType !== 'application') {
      throw new SchematicsException(`Web Worker requires a project type of "application".`);
    }

    const projectTarget = project.targets.get(options.target);
    if (!projectTarget) {
      throw new Error(`Target is not defined for this project.`);
    }
    const projectTargetOptions = (projectTarget.options || {}) as unknown as BrowserBuilderOptions;

    if (options.path === undefined) {
      options.path = buildDefaultPath(project);
    }

    const parsedPath = parseName(options.path, options.name);
    options.name = parsedPath.name;
    options.path = parsedPath.path;
    const root = project.root || '';
    const needWebWorkerConfig = !projectTargetOptions.webWorkerTsConfig;

    if (needWebWorkerConfig) {
      const workerConfigPath = join(normalize(root), 'tsconfig.worker.json');
      projectTargetOptions.webWorkerTsConfig = workerConfigPath;
    }

    checkForTsConfigWorkerExclusion(tree, projectTargetOptions.tsConfig)

    const templateSource = apply(url('./files/worker'), [
      applyTemplates({ ...options, ...strings }),
      move(parsedPath.path),
    ]);


    return chain([
      needWebWorkerConfig ? addConfig(options, root) : noop(),
      needWebWorkerConfig ? updateWorkspace(workspace) : noop(),
      mergeWith(templateSource)
    ]);

  };
}
