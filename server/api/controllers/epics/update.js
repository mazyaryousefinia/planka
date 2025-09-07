/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { isDueDate, isStopwatch } = require('../../../utils/validators');
const { idInput } = require('../../../utils/inputs');

const Errors = {
  EPIC_NOT_FOUND: {
    epicNotFound: 'Epic not found',
  },
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
};

module.exports = {
  inputs: {
    id: {
      ...idInput,
      required: true,
    },
    position: {
      type: 'number',
      min: 0,
    },
    name: {
      type: 'string',
      maxLength: 1024,
    },
    description: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 1048576,
      allowNull: true,
    },
    dueDate: {
      type: 'string',
      custom: isDueDate,
      allowNull: true,
    },
    isDueCompleted: {
      type: 'boolean',
    },
    stopwatch: {
      type: 'json',
      custom: isStopwatch,
    },
    isCompleted: {
      type: 'boolean',
    },
  },

  exits: {
    epicNotFound: {
      responseType: 'notFound',
    },
    notEnoughRights: {
      responseType: 'forbidden',
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
          throw Errors.NOT_ENOUGH_RIGHTS;
        }
      }
    }

    const { card: updatedEpic } = await sails.helpers.cards.updateOne.with({
      record: epic,
      values: _.pick(inputs, [
        'position',
        'name',
        'description',
        'dueDate',
        'isDueCompleted',
        'stopwatch',
        'isCompleted',
      ]),
      request: this.req,
    });

    return {
      item: updatedEpic,
    };
  },
};
