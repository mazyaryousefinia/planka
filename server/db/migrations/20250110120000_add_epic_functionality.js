/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

exports.up = async (knex) => {
  await knex.schema.alterTable('card', (table) => {
    /* Columns */
    table.bigInteger('parent_card_id');

    /* Indexes */
    table.index('parent_card_id');

    /* Foreign Keys */
    table.foreign('parent_card_id').references('id').inTable('card').onDelete('SET NULL');
  });

  return knex;
};

exports.down = async (knex) => {
  await knex.schema.alterTable('card', (table) => {
    table.dropForeign('parent_card_id');
    table.dropColumn('parent_card_id');
  });


  return knex;
};
