const express = require("express"); // Load the express module
const morgan = require("morgan");  // Load the `morgan` module
const flash = require("express-flash");
const { body, validationResult } = require("express-validator");
const session = require("express-session");
const store = require("connect-loki");

const app = express(); // Create the Express application object, app
const port = 3000; // Define the host and port to which that the app listens for HTTP connections
const host = "localhost";
const LokiStore = store(session);

app.set("views", "./views"); // Tell Express where to find view templates.
app.set("view engine", "pug"); // Tell express to use Pug as the view engine.

app.use(morgan("common")); // Enable logging with morgan
app.use(express.static("public")); // Tell Express where to find its static assets.
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000,
    path: "/",
    secure: false,
  },
  name: "launch-school-teams-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});
app.use((req, res, next) => {
  let teamList = [];
  if ("teamList" in req.session) {
    req.session.teamList.forEach(team => {
      teamList.push(team);
    });
  }
  req.session.teamList = teamList;
  next();
});

// Define functions
const compareByName = (itemA, itemB) => {
  let nameA = itemA.name.toLowerCase();
  let nameB = itemB.name.toLowerCase();

  if (nameA < nameB) {
    return -1;
  } else if (nameA > nameB) {
    return 1;
  } else {
    return 0;
  }
};

const sortTeamList = teamList => {
  return teamList.sort(compareByName);
};

const sortTeamMembers = members => {
  return members.sort(compareByName);
};

app.get("/", (req, res) => {
  res.redirect("/teams");
});

app.get("/teams", (req, res) => {
  res.render("teams", {
    teamList: sortTeamList(req.session.teamList),
  });
});

app.get("/teams/new", (req, res) => {
  res.render("new-team");
});

app.get("/teams/:teamName", (req, res, next) => {
  let teamName = req.params.teamName;
  let team = req.session.teamList.find(team => team.name === teamName);
  if (!teamName) {
    next(new Error("Not found."));
  } else {
    res.render("team", {
      team: team,
      members: sortTeamMembers(team.members),
    });
  }
});

app.post("/teams/:teamName/members/new", 
  [
    body("memberName")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Member name is required.")
    .isLength({ max: 50 })
    .withMessage("Name must be less than 100 characters.")
    .bail()
    .custom((value, { req }) => {
      let team = req.session.teamList.find(team => team.name === req.params.memberName);
      return !team.members.find(member => member.name === value);
    })
    .withMessage("Member name must be unique."),

    body("memberAge")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Member age is required.")
    .custom((age, { req }) => {
      let regex = /(?:\b|-)([1-9]{1,2}[0]?|100)\b/;
      return age.match(regex);
    })
    .withMessage("Age must be between 1 and 100."),

    body("memberSex")
    .isLength({ min: 1 })
    .withMessage("Please choose one option of member's sex.")
  ],
  (req, res, next) => {
    let teamName = req.params.teamName;
    let team = req.session.teamList.find(team => team.name === teamName);
    if (!team) {
      next(new Error("Not found."));
    } else {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(error => req.flash("error", error.msg));
        res.render("team", {
          flash: req.flash(),
          team: team,
          members: sortTeamMembers(team.members),
          memberName: req.body.memberName,
          memberAge: req.body.memberAge,
        });
      } else {
        team.members.push({
          name: req.body.memberName,
          age: req.body.memberAge,
          sex: req.body.memberSex,
        });
        req.flash("success", "New member added.");
        res.redirect(`/teams/${teamName}`);
      }
    }
  });

app.post("/teams", 
  [
    body("teamName")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Team name is required.")
    .isLength({ max: 100 })
    .withMessage("Team name must be less than 100 characters.")
    .bail()
    .custom((value, { req }) => {
      let teamList = req.session.teamList;
      return !teamList.some(team => team.name === value);
    })
    .withMessage("Team name must be unique."),

    body("teamActivity")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Activity name is required.")
    .isLength({ max: 100 })
    .withMessage("Activity name must be less than 100 characters.")
  ],
  (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(error => req.flash("error", error.msg));
      res.render("new-team", {
        flash: req.flash(),
        teamName: req.body.teamName,
        teamActivity: req.body.teamActivity,
      });
    } else {
      req.session.teamList.push({
        name: req.body.teamName,
        activity: req.body.teamActivity,
        members: [],
      });
      req.flash("success", "New team created.");
      res.redirect("/teams");
    }
  });

  app.post("/teams/:teamName/members/:memberName/delete", (req, res, next) => {
    let memberName = req.params.memberName;
    let teamName = req.params.teamName;
    let team = req.session.teamList.find(team => team.name === teamName);

    if(!team) {
      next(new Error("Not found."));
    } else {
      let idx = team.members.findIndex(member => member.name === memberName);
      if (idx === -1) {
        next(new Error('Not found.'));
      } else {
        team.members.splice(idx, 1);
        req.flash("success", "Member deleted.");
        res.redirect(`/teams/${teamName}`);
      }
    }
  })

// Tell Express to listen for HTTP requests on the specified host and port.
app.listen(port, host, () => {
  console.log(`Team is listening on port ${port} of ${host}!`);
});