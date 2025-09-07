/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  EPIC_NOT_FOUND: {
    epicNotFound: 'Epic not found',
  },
  STORY_NOT_FOUND: {
    storyNotFound: 'Story not found',
  },
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  INVALID_STORY_TYPE: {
    invalidStoryType: 'Card must be of type STORY to link to Epic',
  },
  STORY_ALREADY_LINKED: {
    storyAlreadyLinked: 'Story is already linked to an Epic',
  },
};

module.exports = {
  inputs: {
    epicId: {
      ...idInput,
      required: true,
    },
    storyId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    epicNotFound: {
      responseType: 'notFound',
    },
    storyNotFound: {
      responseType: 'notFound',
    },
    notEnoughRights: {
      responseType: 'forbidden',
    },
    invalidStoryType: {
      responseType: 'unprocessableEntity',
    },
    storyAlreadyLinked: {
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

    const { card: story, project: storyProject } = await sails.helpers.cards
      .getPathToProjectById(inputs.storyId)
      .intercept('pathNotFound', () => Errors.STORY_NOT_FOUND);

    if (story.type !== Card.Types.STORY) {
      throw Errors.INVALID_STORY_TYPE;
    }

    if (story.parentCardId) {
      throw Errors.STORY_ALREADY_LINKED;
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

    if (currentUser.role !== User.Roles.ADMIN || storyProject.ownerProjectManagerId) {
      const isStoryProjectManager = await sails.helpers.users.isProjectManager(
        currentUser.id,
        storyProject.id,
      );

      if (!isStoryProjectManager) {
        const storyBoardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
          story.boardId,
          currentUser.id,
        );

        if (!storyBoardMembership) {
          throw Errors.NOT_ENOUGH_RIGHTS;
        }
      }
    }

    const updatedStory = await Card.updateOne({ id: story.id }).set({
      parentCardId: epic.id,
    });

    sails.sockets.broadcast(
      `board:${epic.boardId}`,
      'cardUpdate',
      {
        item: updatedStory,
      },
      this.req,
    );

    if (story.boardId !== epic.boardId) {
      sails.sockets.broadcast(
        `board:${story.boardId}`,
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
