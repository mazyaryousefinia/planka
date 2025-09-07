/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  PROJECT_NOT_FOUND: {
    projectNotFound: 'Project not found',
  },
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  PROJECT_NOT_LINKED: {
    projectNotLinked: 'Project is not linked to an Epic',
  },
};

module.exports = {
  inputs: {
    projectId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    projectNotFound: {
      responseType: 'notFound',
    },
    notEnoughRights: {
      responseType: 'forbidden',
    },
    projectNotLinked: {
      responseType: 'unprocessableEntity',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const { card: project, project: projectProject } = await sails.helpers.cards
      .getPathToProjectById(inputs.projectId)
      .intercept('pathNotFound', () => Errors.PROJECT_NOT_FOUND);

    if (!project.parentCardId) {
      throw Errors.PROJECT_NOT_LINKED;
    }

    if (currentUser.role !== User.Roles.ADMIN || projectProject.ownerProjectManagerId) {
      const isProjectManager = await sails.helpers.users.isProjectManager(
        currentUser.id,
        projectProject.id,
      );

      if (!isProjectManager) {
        const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
          project.boardId,
          currentUser.id,
        );

        if (!boardMembership) {
          throw Errors.NOT_ENOUGH_RIGHTS;
        }
      }
    }

    const epic = await Card.findOne({ id: project.parentCardId });

    const updatedProject = await Card.updateOne({ id: project.id }).set({
      parentCardId: null,
    });

    sails.sockets.broadcast(
      `board:${project.boardId}`,
      'cardUpdate',
      {
        item: updatedProject,
      },
      this.req,
    );

    if (epic && epic.boardId !== project.boardId) {
      sails.sockets.broadcast(
        `board:${epic.boardId}`,
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