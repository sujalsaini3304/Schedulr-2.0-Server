import express from "express";
import dotenv from "dotenv";
import pkg from "pg";
import becrypt from "bcrypt";
import { generateJwtToken, jwtAuthMiddleware } from "./jwtAuth.js";

const { Pool } = pkg;

dotenv.config({
  path: ".env",
});

const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT } = process.env;

const pool = new Pool({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: PGPORT,
  ssl: {
    require: true,
  },
});

const router = express.Router();

router.get("/", async (req, res) => {
  res.json({
    message: "Server Started",
    status: "okay",
  });
});

// Field required - username , password
// or Field required - username , password , profileImageUrl
router.post("/api/createUser", async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }
  const { username, password, profileImageUrl } = req.body;
  try {
    if (username && password) {
      const key = await becrypt.hash(password, 10);
      await client.query(
        "CREATE TABLE IF NOT EXISTS users (username VARCHAR(30) NOT NULL PRIMARY KEY , password TEXT NOT NULL , profile_image_url varchar(500) DEFAULT NULL , original_name VARCHAR(200) DEFAULT NULL , created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )"
      );

      const query = `INSERT INTO users (username, password, profile_image_url) VALUES ($1, $2, $3)`;
      await client.query(query, [username, key, profileImageUrl || null]);

      const token = generateJwtToken({ username: username });

      res.status(200).json({
        message: "User created",
        JwtToken: token,
      });
    } else {
      res.status(400).json({
        message: "Error in creating account",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: error,
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// Field required - username , password
router.post("/api/deleteUser", async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }
  const { username, password } = req.body;
  try {
    const response = await client.query(
      `select username , password from users where username= $1`,
      [username]
    );
    if (response) {
      const flag = await becrypt.compare(password, response.rows[0].password);
      if (flag) {
        await client.query(`DELETE FROM users WHERE username = $1`, [username]);
        res.status(200).json({
          message: "User deleted",
          status: 1,
        });
      } else {
        res.status(400).json({
          message: "Incorrect password",
          status: 0,
        });
      }
    } else {
      res.status(404).json({
        message: "User not there",
        status: 0,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: error,
      status: 0,
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// Field required - username , password
router.post("/api/verifyUser", async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }

  const { username, password } = req.body;
  try {
    const response = await client.query(
      `SELECT * FROM users WHERE username=$1`,[username]
    );
    if (response.rows.length != 0 && await becrypt.compare(password , response.rows[0].password)) {
      const payload = {
        username: username,
      };
      const token = generateJwtToken(payload);
      res.status(200).json({
        message: "User verified",
        result: response.rows[0],
        JwtToken: token,
        status: 1,
      });
    } else {
      res.status(400).json({
        message: "User not there",
        status: 0,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: "Error",
      status: 0,
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// Field required - day, from_time, to_time, period, subject, branch, section, teacher
router.post("/api/set/schedule", jwtAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }
  const { day, from_time, to_time, period, subject, branch, section } =
    req.body;
  const { username } = req.user;
  try {
    const name = await client.query(
      `SELECT original_name FROM users where username = $1 `,
      [username]
    );
    await client.query(
      "CREATE TABLE IF NOT EXISTS schedule ( username VARCHAR(30) REFERENCES users(username) ON DELETE CASCADE , day VARCHAR(30) , from_time VARCHAR(10) , to_time VARCHAR(10) , period INT , subject TEXT , branch VARCHAR(30) , section VARCHAR(4) ,  teacher VARCHAR(200) , created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )"
    );
    const result = await client.query(
      `SELECT * from schedule where username = $1 AND period = $2 `,
      [username, period]
    );
    if (
      day &&
      from_time &&
      to_time &&
      period &&
      subject &&
      branch &&
      section &&
      name.rows.length != 0 &&
      period <= process.env.MAX_PERIOD_LIMIT &&
      result.rows.length == 0
    ) {
      await client.query(
        `INSERT INTO schedule (username , day ,from_time ,to_time, period , subject , branch , section , teacher) VALUES ( $1 , $2 , $3, $4 , $5 , $6, $7, $8, $9)`,
        [
          username,
          day,
          from_time,
          to_time,
          period,
          subject,
          branch,
          section,
          name.rows[0].original_name == null
            ? username
            : name.rows[0].original_name,
        ]
      );
      res.status(200).json({
        message: "Schedule created",
        status: 1,
      });
    } else {
      res.status(400).json({
        message: "Schedule not created",
        status: 0,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: "Error in creating schedule",
      status: 0,
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// get schedule
router.post("/api/get/schedule", jwtAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }
  const { username } = req.user;
  try {
    const response = await client.query(
      `SELECT * FROM schedule WHERE username = $1 ORDER BY period `,
      [username]
    );
    if (response.rows.length != 0) {
      res.status(200).json({
        message: "Schedule fetched",
        data: response.rows,
        status: 1,
      });
    } else {
      res.status(400).json({
        message: "Schedule not fetched",
        status: 0,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: error,
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// update original_name
router.post("/api/update/profileName", jwtAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }
  const { new_name } = req.body;
  const { username } = req.user;
  try {
    const response1 = await client.query(
      `UPDATE users SET original_name = $1 WHERE username = $2`,
      [new_name, username]
    );
    const response2 = await client.query(
      `UPDATE schedule SET teacher = $1 WHERE username = $2`,
      [new_name, username]
    );
    if (response1 && response2) {
      res.status(200).json({
        message: "Name changed",
        status: 1,
      });
    } else {
      res.status(400).json({
        message: "New name not updated",
        status: 0,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: error,
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// update others details excluding profileName of schedule
router.post("/api/update/details", jwtAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }
  const { username } = req.user;
  const {
    new_subject,
    new_branch,
    new_section,
    new_period,
    new_to_time,
    new_from_time,
    new_day,
  } = req.body;
  try {
    if (new_branch && username) {
      await client
        .query(`UPDATE schedule SET branch = $1 WHERE username = $2`, [
          new_branch,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "Branch changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "Branch not changed",
            status: 0,
          });
        });
    }

    if (new_subject && username) {
      await client
        .query(`UPDATE schedule SET subject = $1 WHERE username = $2`, [
          new_subject,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "subject changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "subject not changed",
            status: 0,
          });
        });
    }

    if (new_section && username) {
      await client
        .query(`UPDATE schedule SET section = $1 WHERE username = $2`, [
          new_section,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "section changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "section not changed",
            status: 0,
          });
        });
    }

    if (new_from_time && username) {
      await client
        .query(`UPDATE schedule SET from_time = $1 WHERE username = $2`, [
          new_from_time,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "from_time changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "from_time not changed",
            status: 0,
          });
        });
    }

    if (new_to_time && username) {
      await client
        .query(`UPDATE schedule SET to_time = $1 WHERE username = $2`, [
          new_to_time,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "to_time changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "to_time not changed",
            status: 0,
          });
        });
    }

    if (new_period && username) {
      await client
        .query(`UPDATE schedule SET period = $1 WHERE username = $2`, [
          new_period,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "period changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "period not changed",
            status: 0,
          });
        });
    }

    if (new_day && username) {
      await client
        .query(`UPDATE schedule SET day = $1 WHERE username = $2`, [
          new_day,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "day changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "day not changed",
            status: 0,
          });
        });
    }

    if (
      (!new_branch &&
        !new_day &&
        !new_from_time &&
        !new_period &&
        !new_section &&
        !new_subject &&
        !new_to_time) ||
      !username
    ) {
      res.status(404).json({
        message: "updatation failed",
        status: 0,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: error,
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

export default router;
