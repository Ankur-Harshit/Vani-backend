const express = require("express");
const paymentRouter = new express.Router();
const { userAuth } = require("../middlewares/auth");
const razorpayInstance = require("../utils/razorpay");
const Payment = require("../models/payment");
const User = require("../models/user");
const membershipAmount = require("../utils/constants");
const {
  validatePaymentVerification,
  validateWebhookSignature,
} = require("razorpay/dist/utils/razorpay-utils");

paymentRouter.post("/payment/create", userAuth, async (req, res) => {
  try {
    const { membership } = req.body;
    const { firstName, lastName, emailId } = req.user;
    const order = await razorpayInstance.orders.create({
      amount: membershipAmount[membership] * 100,
      currency: "INR",
      receipt: "receipt#1",
      notes: {
        firstName,
        lastName,
        emailId,
        membership,
      },
    });
    const payment = new Payment({
      orderId: order.id,
      userId: req.user._id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      notes: order.notes,
      receipt: order.receipt,
    });
    const savedPayment = await payment.save();
    res.json({
      savedPayment: savedPayment.toObject(),
      keyId: process.env.RAZORPAY_KEY,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: err.message });
  }
});

paymentRouter.post("/payment/webhook", async (req, res) => {
  try {
    const webhookSignature = req.get("X-Razorpay-Signature");
    const isWebhookValid = validateWebhookSignature(
      JSON.stringify(req.body),
      webhookSignature,
      process.env.RAZORPAY_WEBHOOK_SECRET,
    );

    if (!isWebhookValid) {
      return res.status(400).json({ message: "Invalid Webhook Signature" });
    }

    // update payment in DB //
    const paymentDetails = req.body.payload.payment.entity;
    const payment = await Payment.findOne({ orderId: paymentDetails.order_id });
    payment.status = paymentDetails.status;
    payment.paymentId = paymentDetails.id;
    await payment.save();
    const userId = payment.userId;
    const user = await User.findById(userId);
    user.membership = payment.notes.membership;
    user.isVerified = true;
    await user.save();

    return res.status(200).json({ message: "Successful webhook" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

paymentRouter.get("/payment/verify", userAuth, async (req, res) => {
  try {
    const user = req.user;
    return res.send(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = paymentRouter;
