/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  STORY_NOT_FOUND: {
    storyNotFound: 'Story not found',
  },
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  STORY_NOT_LINKED: {
    storyNotLinked: 'Story is not linked to any Epic',
  },
};

module.exports = {
  inputs: {
    storyId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    storyNotFound: {
      responseType: 'notFound',
    },
    notEnoughRights: {
      responseType: 'forbidden',
    },
    storyNotLinked: {
      responseType: 'unprocessableEntity',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const { card: story, project } = await sails.helpers.cards
      .getPathToProjectById(inputs.storyId)
      .intercept('pathNotFound', () => Errors.STORY_NOT_FOUND);

    if (!story.parentCardId) {
      throw Errors.STORY_NOT_LINKED;
    }

    if (currentUser.role !== User.Roles.ADMIN || project.ownerProjectManagerId) {
      const isProjectManager = await sails.helpers.users.isProjectManager(
        currentUser.id,
        project.id,
      );

      if (!isProjectManager) {
        const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
          story.boardId,
          currentUser.id,
        );

        if (!boardMembership) {
          throw Errors.NOT_ENOUGH_RIGHTS;
        }
      }
    }

    const epic = await Card.findOne({ id: story.parentCardId });

    const updatedStory = await Card.updateOne({ id: story.id }).set({
      parentCardId: null,
    });

    sails.sockets.broadcast(
      `board:${story.boardId}`,
      'cardUpdate',
      {
        item: updatedStory,
      },
      this.req,
    );

    if (epic && epic.boardId !== story.boardId) {
      sails.sockets.broadcast(
        `board:${epic.boardId}`,
        'cardUpdate',
        {
          item: updatedStory,
        },
        this.req,
      );
    }

    return {
      item: updatedStory,
    };
  },
};
