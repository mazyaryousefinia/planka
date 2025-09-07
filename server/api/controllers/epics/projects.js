/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  EPIC_NOT_FOUND: {
    epicNotFound: 'Epic not found',
  },
};

module.exports = {
  inputs: {
    id: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    epicNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const { card: epic, project } = await sails.helpers.cards
      .getPathToProjectById(inputs.id)
      .intercept('pathNotFound', () => Errors.EPIC_NOT_FOUND);

    if (epic.type !== Card.Types.EPIC) {
      throw Errors.EPIC_NOT_FOUND;
    }

    if (currentUser.role !== User.Roles.ADMIN || project.ownerProjectManagerId) {
      const isProjectManager = await sails.helpers.users.isProjectManager(
        currentUser.id,
        project.id,
      );

      if (!isProjectManager) {
        const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
          epic.boardId,
          currentUser.id,
        );

        if (!boardMembership) {
          throw Errors.EPIC_NOT_FOUND;
        }
      }
    }

    const projects = await Card.find({
      parentCardId: epic.id,
      type: Card.Types.PROJECT,
    });

    return {
      items: projects,
    };
  },
};