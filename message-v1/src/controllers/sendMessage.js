const http = require("http");
const saveMessage = require("../clients/saveMessage");
const debugError = require("debug")("message:error");
const debugTimeout = require("debug")("message:timeout");
const random = n => Math.floor(Math.random() * Math.floor(n));
const braker = require("../../circuitBreaker");
const logger = require('../winston/winston')

module.exports = function(msgData, done) {
  const entireMsg = msgData;
  const body = JSON.stringify(msgData.job);

  if (msgData.isThereBalance) {
    const postOptions = {
      //host: "messageapp",
      host: "localhost",
      port: 3000,
      path: "/message",
      method: "post",
      json: true,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    };

    if (msgData.isThereBalance) {
      function asyncFunction(postOptions) {
        return new Promise(function(resolve, reject) {
          let postReq = http.request(postOptions);

          postReq.on("response", postRes => {
            if (postRes.statusCode === 200) {
              saveMessage(
                {
                  destination: entireMsg.job.destination,
                  body: entireMsg.job.body,
                  uuid: entireMsg.job.uuid,
                  status: "OK"
                },
                function(_result, error) {
                  if (error) {
                    logger.error(error);
                  } else {
                    logger.info('enters cb');
                    logger.info(postRes.body);
                  }
                }
                );
              done();
              return resolve("resolved succesfully");
            } else {
              logger.error("Error while sending message");
              saveMessage(
                {
                  destination: entireMsg.job.destination,
                  body: entireMsg.job.body,
                  uuid: entireMsg.job.uuid,
                  status: "ERROR"
                },
                () => {
                  logger.error("Internal server error: SERVICE ERROR");
                }
              );
              done('err');
              return reject("Error while sending message");
            }
          });

          postReq.setTimeout(random(6000));

          postReq.on("timeout", () => {
            logger.warn("Timeout Exceeded!");
            postReq.abort();

            saveMessage(
              {
                destination: entireMsg.job.destination,
                body: entireMsg.job.body,
                uuid: entireMsg.job.uuid,
                status: "TIMEOUT"
              },
              () => {
                logger.warn("Internal server error: TIMEOUT");
              }
            );
            done('err');
            return reject(new Error("Timeout error"));
          });

          postReq.on("error", err => {
            logger.error("err");
          });
          postReq.write(body);
          postReq.end();
        });
      }
    }

    const circuit = braker.slaveCircuit(asyncFunction);
    circuit
      .exec(postOptions)
      .then(result => {
        logger.info(`result: ${result}`);
      })
      .catch(err => {
        logger.error(`${err}`);
      });
  } else {
    logger.error("No credit error");
  }
};