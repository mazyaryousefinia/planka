/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  EPIC_NOT_FOUND: {
    epicNotFound: 'Epic not found',
  },
  PROJECT_NOT_FOUND: {
    projectNotFound: 'Project not found',
  },
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  INVALID_PROJECT_TYPE: {
    invalidProjectType: 'Card must be of type PROJECT to link to Epic',
  },
  PROJECT_ALREADY_LINKED: {
    projectAlreadyLinked: 'Project is already linked to an Epic',
  },
};

module.exports = {
  inputs: {
    epicId: {
      ...idInput,
      required: true,
    },
    projectId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    epicNotFound: {
      responseType: 'notFound',
    },
    projectNotFound: {
      responseType: 'notFound',
    },
    notEnoughRights: {
      responseType: 'forbidden',
    },
    invalidProjectType: {
      responseType: 'unprocessableEntity',
    },
    projectAlreadyLinked: {
      responseType: 'conflict',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const { card: epic, project: epicProject } = await sails.helpers.cards
      .getPathToProjectById(inputs.epicId)
      .intercept('pathNotFound', () => Errors.EPIC_NOT_FOUND);

    if (epic.type !== Card.Types.EPIC) {
      throw Errors.EPIC_NOT_FOUND;
    }

    const { card: project, project: projectProject } = await sails.helpers.cards
      .getPathToProjectById(inputs.projectId)
      .intercept('pathNotFound', () => Errors.PROJECT_NOT_FOUND);

    if (project.type !== Card.Types.PROJECT) {
      throw Errors.INVALID_PROJECT_TYPE;
    }

    if (project.parentCardId) {
      throw Errors.PROJECT_ALREADY_LINKED;
    }

    if (currentUser.role !== User.Roles.ADMIN || epicProject.ownerProjectManagerId) {
      const isEpicProjectManager = await sails.helpers.users.isProjectManager(
        currentUser.id,
        epicProject.id,
      );

      if (!isEpicProjectManager) {
        const epicBoardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
          epic.boardId,
          currentUser.id,
        );

        if (!epicBoardMembership) {
          throw Errors.NOT_ENOUGH_RIGHTS;
        }
      }
    }

    if (currentUser.role !== User.Roles.ADMIN || projectProject.ownerProjectManagerId) {
      const isProjectProjectManager = await sails.helpers.users.isProjectManager(
        currentUser.id,
        projectProject.id,
      );

      if (!isProjectProjectManager) {
        const projectBoardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
          project.boardId,
          currentUser.id,
        );

        if (!projectBoardMembership) {
          throw Errors.NOT_ENOUGH_RIGHTS;
        }
      }
    }

    const updatedProject = await Card.updateOne({ id: project.id }).set({
      parentCardId: epic.id,
    });

    sails.sockets.broadcast(
      `board:${epic.boardId}`,
      'cardUpdate',
      {
        item: updatedProject,
      },
      this.req,
    );

    if (project.boardId !== epic.boardId) {
      sails.sockets.broadcast(
        `board:${project.boardId}`,
        'cardUpdate',
        {
          item: updatedProject,
        },
        this.req,
      );
    }

    return {
      item: updatedProject,
    };
  },
};