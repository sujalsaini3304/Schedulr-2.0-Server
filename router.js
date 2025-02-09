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
    developer_details: {
      developer_name: "Sujal Kumar Saini",
      email: "sujalsaini3304@gmail.com",
    },
  });
});

// Field required - username , password
// or Field required - username , password , profileImageUrl
router.post("/api/create/user", async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }
  const { username, password } = req.body;
  try {
    if (username && password) {
      const key = await becrypt.hash(password, 10);
      await client.query(
        "CREATE TABLE IF NOT EXISTS users (username VARCHAR(30) NOT NULL PRIMARY KEY , password TEXT NOT NULL , created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )"
      );
      // Date to be given in  -> yyyy-mm-dd format
      await client.query(
        `CREATE TABLE IF NOT EXISTS user_details (username VARCHAR(30) REFERENCES users(username) ON DELETE CASCADE NOT NULL PRIMARY KEY , profile_image_url VARCHAR(500) DEFAULT NULL , original_name VARCHAR(200) DEFAULT NULL , dob DATE DEFAULT NULL , profession VARCHAR(100) DEFAULT NULL , experience int DEFAULT 0 , about TEXT DEFAULT NULL , profile_bio VARCHAR(50) DEFAULT null , created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )`
      );
      const query = `INSERT INTO users (username, password) VALUES ($1, $2)`;
      await client.query(query, [username, key]);
      await client.query(`INSERT INTO user_details (username) VALUES ($1)`, [
        username,
      ]);

      const token = generateJwtToken({ username: username });

      res.status(200).json({
        message: "User created",
        jwt_token: token,
      });
    } else {
      res.status(400).json({
        message:"Account not created.",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: "Error in creating account.",
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// Field required - username , password
router.post("/api/delete/user", async (req, res) => {
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
    if (response && response.rows.length != 0 ) {
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
      message: "Error occured in deletion of account.",
      status: 0,
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// Field required - username , password
router.post("/api/verify/user", async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }

  const { username, password } = req.body;
  try {
    const response = await client.query(
      `SELECT * FROM users WHERE username=$1`,
      [username]
    );
    const userInfo = await client.query(
      `SELECT * FROM user_details WHERE username=$1`,
      [username]
    );
    if (
      response.rows.length != 0 &&
      (await becrypt.compare(password, response.rows[0].password))
    ) {
      const payload = {
        username: username,
      };
      const token = generateJwtToken(payload);
      res.status(200).json({
        message: "User verified",
        data: userInfo.rows[0],
        jwt_token: token,
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
      message: "Error in verification process.",
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
  const { day, from_time, to_time, period, subject, branch, section , semester } =
    req.body;
  const { username } = req.user;
  try {
    const name = await client.query(
      `SELECT original_name FROM user_details where username = $1 `,
      [username]
    );
    await client.query(
      "CREATE TABLE IF NOT EXISTS schedule ( username VARCHAR(30) REFERENCES users(username) ON DELETE CASCADE , day VARCHAR(30) , from_time VARCHAR(10) , to_time VARCHAR(10) , period INT , subject TEXT , branch VARCHAR(30) , section VARCHAR(4) , semester INT ,  instructor VARCHAR(200) , created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP PRIMARY KEY NOT NULL )"
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
      result.rows.length == 0 &&
      semester 
    ) {
      await client.query(
        `INSERT INTO schedule (username , day ,from_time ,to_time, period , subject , branch , section , semester , instructor) VALUES ( $1 , $2 , $3, $4 , $5 , $6, $7, $8, $9 , $10)`,
        [
          username,
          day,
          from_time,
          to_time,
          period,
          subject,
          branch,
          section,
          semester ,
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
        message: "Schedule fetched.",
        data: response.rows,
        status: 1,
      });
    } else {
      res.status(400).json({
        message: "Schedule not fetched.",
        status: 0,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: "Error in fetching the schedule.",
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// update user information -> profile_image_url  , dob , profession, experience , about  , profile_bio
router.post("/api/update/user/info", jwtAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  if (client) {
    console.log("Connection build to neon pg database successfully");
  } else {
    console.log("Connection failed while connectiong to neon pg database");
  }
  const {
    new_name,
    new_dob_year,
    new_dob_month,
    new_dob_date,
    new_profession,
    new_experience,
    new_about,
    new_profile_bio,
    new_profile_image_url,
  } = req.body;
  const { username } = req.user;

  try {
    if (new_name) {
      const flag = await client.query(
        "SELECT EXISTS( SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule' )"
      );
      if (flag.rows[0].exists) {
        await client
          .query(`UPDATE schedule SET instructor = $1 WHERE username = $2`, [
            new_name,
            username,
          ])
          .catch((e) => {
            res.status(404).json({
              message: "New name not updated",
              status: 0,
            });
            console.log(e);
            return;
          });
      }

      await client
        .query(
          `UPDATE user_details SET original_name = $1 WHERE username = $2`,
          [new_name, username]
        )
        .then(() => {
          res.status(200).json({
            message: "Name changed",
            status: 1,
          });
        })
        .catch((e) => {
          res.status(400).json({
            message: "New name not updated",
            status: 0,
          });
          console.log(e);
        });
    }

    if (new_dob_year && new_dob_month && new_dob_date) {
      await client
        .query(`UPDATE user_details SET dob = $1 WHERE username = $2`, [
          `${new_dob_year}-${new_dob_month}-${new_dob_date}`,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "user dob changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "user dob not changed",
            status: 0,
          });
        });
    }

    if (new_profession) {
      await client
        .query(`UPDATE user_details SET profession = $1 WHERE username = $2`, [
          new_profession,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "user profession changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "user profession not changed",
            status: 0,
          });
        });
    }

    if (new_experience) {
      await client
        .query(`UPDATE user_details SET experience = $1 WHERE username = $2`, [
          new_experience,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "user experience changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "user experience not changed",
            status: 0,
          });
        });
    }

    if (new_profile_bio) {
      await client
        .query(`UPDATE user_details SET profile_bio = $1 WHERE username = $2`, [
          new_profile_bio,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "user profile bio changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "user profile bio not changed",
            status: 0,
          });
        });
    }

    if (new_profile_image_url) {
      await client
        .query(
          `UPDATE user_details SET profile_image_url = $1 WHERE username = $2`,
          [new_profile_image_url, username]
        )
        .then((e) => {
          res.status(200).json({
            message: "user profile image url changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "user profile image url not changed",
            status: 0,
          });
        });
    }

    if (new_about) {
      await client
        .query(`UPDATE user_details SET about = $1 WHERE username = $2`, [
          new_about,
          username,
        ])
        .then((e) => {
          res.status(200).json({
            message: "user about changed",
            status: 1,
          });
        })
        .catch((e) => {
          console.log(e);
          res.status(400).json({
            message: "user about not changed",
            status: 0,
          });
        });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({
      message: "Error in updating user information.",
    });
  } finally {
    client.release();
    console.log("Connection closed successfully.");
  }
});

// updating schedule 
router.post(
  "/api/update/schedule/details",
  jwtAuthMiddleware,
  async (req, res) => {
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
        message: "Error occured while updating the schedule.",
      });
    } finally {
      client.release();
      console.log("Connection closed successfully.");
    }
  }
);

export default router;
