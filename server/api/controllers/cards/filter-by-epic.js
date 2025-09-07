/*!
 * Filter cards by epic parent
 * Returns all cards (projects and stories) that have the specified epic as parent
 */

module.exports = {
  friendlyName: 'Filter cards by epic',

  description: 'Get all cards (projects and stories) that belong to a specific epic',

  inputs: {
    epicId: {
      type: 'string',
      required: true,
      description: 'The ID of the epic to filter cards by',
    },
  },

  exits: {
    success: {
      description: 'Cards filtered successfully',
    },
    notFound: {
      description: 'Epic not found',
      responseType: 'notFound',
    },
    forbidden: {
      description: 'Access denied',
      responseType: 'forbidden',
    },
  },

  fn: async function (inputs, exits) {
    const { epicId } = inputs;
    const { currentUser } = this.req;

    if (!sails.helpers.isValidId(epicId)) {
      return exits.notFound();
    }

    const epic = await Card.findOne({
      id: epicId,
      type: Card.Types.EPIC,
    });

    if (!epic) {
      return exits.notFound();
    }

    const board = await Board.findOne({
      id: epic.boardId,
    }).populate('memberships', {
      where: {
        userId: currentUser.id,
      },
    });

    if (!board) {
      return exits.notFound();
    }

    const isAdmin = currentUser.isAdmin;
    const isProjectManager = await ProjectManager.count({
      projectId: board.projectId,
      userId: currentUser.id,
    });
    const isBoardMember = board.memberships.length > 0;

    if (!isAdmin && !isProjectManager && !isBoardMember) {
      return exits.forbidden();
    }

    const cards = await Card.find({
      parentCardId: epicId,
      type: {
        in: [Card.Types.PROJECT, Card.Types.STORY],
      },
    }).sort('createdAt ASC');

    const projects = cards.filter(card => card.type === Card.Types.PROJECT);
    const stories = cards.filter(card => card.type === Card.Types.STORY);

    return exits.success({
      epic: {
        id: epic.id,
        name: epic.name,
        description: epic.description,
      },
      cards: {
        projects,
        stories,
        total: cards.length,
      },
    });
  },
};
