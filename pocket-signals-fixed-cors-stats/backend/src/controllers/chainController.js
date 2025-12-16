const db = require('../config/database');

class ChainController {
  // Отримати всі ланцюжки
  async getAll(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          mc.id,
          mc.name,
          mc.trigger_event,
          mc.is_active,
          mc.created_at,
          COUNT(cs.id) as steps_count
        FROM message_chains mc
        LEFT JOIN chain_steps cs ON mc.id = cs.chain_id
        GROUP BY mc.id
        ORDER BY mc.created_at DESC
      `);

      res.json({ chains: result.rows });
    } catch (error) {
      console.error('Error getting chains:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Отримати один ланцюжок з кроками
  async getOne(req, res) {
    try {
      const { id } = req.params;

      // Отримуємо ланцюжок
      const chainResult = await db.query(
        'SELECT * FROM message_chains WHERE id = $1',
        [id]
      );

      if (chainResult.rows.length === 0) {
        return res.status(404).json({ error: 'Chain not found' });
      }

      // Отримуємо кроки
      const stepsResult = await db.query(
        'SELECT * FROM chain_steps WHERE chain_id = $1 ORDER BY step_order',
        [id]
      );

      res.json({
        chain: chainResult.rows[0],
        steps: stepsResult.rows
      });
    } catch (error) {
      console.error('Error getting chain:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Створити новий ланцюжок
  async create(req, res) {
    try {
      const { name, trigger_event, is_active = true, steps = [] } = req.body;

      if (!name || !trigger_event) {
        return res.status(400).json({ 
          error: 'Name and trigger_event are required' 
        });
      }

      // Створюємо ланцюжок
      const chainResult = await db.query(
        `INSERT INTO message_chains (name, trigger_event, is_active)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, trigger_event, is_active]
      );

      const chain = chainResult.rows[0];

      // Додаємо кроки якщо є
      const createdSteps = [];
      for (const step of steps) {
        const stepResult = await db.query(
          `INSERT INTO chain_steps (
            chain_id, step_order, delay_hours, message_type, 
            message_text, image_url, conditions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            chain.id,
            step.step_order,
            step.delay_hours || 0,
            step.message_type,
            step.message_text,
            step.image_url,
            step.conditions ? JSON.stringify(step.conditions) : null
          ]
        );
        createdSteps.push(stepResult.rows[0]);
      }

      res.status(201).json({
        message: 'Chain created successfully',
        chain,
        steps: createdSteps
      });
    } catch (error) {
      console.error('Error creating chain:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Оновити ланцюжок
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, trigger_event, is_active } = req.body;

      const result = await db.query(
        `UPDATE message_chains 
         SET name = COALESCE($1, name),
             trigger_event = COALESCE($2, trigger_event),
             is_active = COALESCE($3, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [name, trigger_event, is_active, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Chain not found' });
      }

      res.json({
        message: 'Chain updated successfully',
        chain: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating chain:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Видалити ланцюжок
  async delete(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM message_chains WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Chain not found' });
      }

      res.json({ message: 'Chain deleted successfully' });
    } catch (error) {
      console.error('Error deleting chain:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Додати крок до ланцюжка
  async addStep(req, res) {
    try {
      const { id } = req.params;
      const { 
        step_order, 
        delay_hours, 
        message_type, 
        message_text, 
        image_url,
        conditions 
      } = req.body;

      if (!step_order || !message_type) {
        return res.status(400).json({ 
          error: 'step_order and message_type are required' 
        });
      }

      const result = await db.query(
        `INSERT INTO chain_steps (
          chain_id, step_order, delay_hours, message_type,
          message_text, image_url, conditions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          id,
          step_order,
          delay_hours || 0,
          message_type,
          message_text,
          image_url,
          conditions ? JSON.stringify(conditions) : null
        ]
      );

      res.status(201).json({
        message: 'Step added successfully',
        step: result.rows[0]
      });
    } catch (error) {
      console.error('Error adding step:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Оновити крок
  async updateStep(req, res) {
    try {
      const { stepId } = req.params;
      const {
        step_order,
        delay_hours,
        message_type,
        message_text,
        image_url,
        conditions
      } = req.body;

      const result = await db.query(
        `UPDATE chain_steps
         SET step_order = COALESCE($1, step_order),
             delay_hours = COALESCE($2, delay_hours),
             message_type = COALESCE($3, message_type),
             message_text = COALESCE($4, message_text),
             image_url = COALESCE($5, image_url),
             conditions = COALESCE($6, conditions)
         WHERE id = $7
         RETURNING *`,
        [
          step_order,
          delay_hours,
          message_type,
          message_text,
          image_url,
          conditions ? JSON.stringify(conditions) : null,
          stepId
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Step not found' });
      }

      res.json({
        message: 'Step updated successfully',
        step: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating step:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Видалити крок
  async deleteStep(req, res) {
    try {
      const { stepId } = req.params;

      const result = await db.query(
        'DELETE FROM chain_steps WHERE id = $1 RETURNING *',
        [stepId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Step not found' });
      }

      res.json({ message: 'Step deleted successfully' });
    } catch (error) {
      console.error('Error deleting step:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ChainController();
