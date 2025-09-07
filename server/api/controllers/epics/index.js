/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  BOARD_NOT_FOUND: {
    boardNotFound: 'Board not found',
  },
};

module.exports = {
  inputs: {
    boardId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    boardNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const { board, project } = await sails.helpers.boards
      .getPathToProjectById(inputs.boardId)
      .intercept('pathNotFound', () => Errors.BOARD_NOT_FOUND);

    if (currentUser.role !== User.Roles.ADMIN || project.ownerProjectManagerId) {
      const isProjectManager = await sails.helpers.users.isProjectManager(
        currentUser.id,
        project.id,
      );

      if (!isProjectManager) {
        const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
          board.id,
          currentUser.id,
        );

        if (!boardMembership) {
          throw Errors.BOARD_NOT_FOUND;
        }
      }
    }

    const epics = await Card.find({
      boardId: board.id,
      type: Card.Types.EPIC,
    }).populate('childCards');

    const epicsWithStories = await Promise.all(
      epics.map(async (epic) => {
        const stories = await Card.find({
          parentCardId: epic.id,
          type: Card.Types.STORY,
        });

        return {
          ...epic,
          stories,
          storyCount: stories.length,
          completedStoryCount: stories.filter(story => story.isCompleted).length,
        };
      })
    );

    return {
      items: epicsWithStories,
    };
  },
};
