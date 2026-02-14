import React from "react";
import { formatCurrency } from "../utils/currency";
import { useParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { useState, useEffect } from"react";
import { getIncomingPay, getOutgoingPay, updateStatus, updateSeshId, getCheckoutIds } from "../controllers/profileController";
import ToggleGroup from "./ToggleGroup";
import { ArrowBigDownDash, ArrowBigUpDash } from 'lucide-react';
import "../styles/TransactionsTable.css";
import supabase from "../lib/supabaseClient";

export default function TransactionsTable({profileId}) {
    const [view, setView] = useState("incoming");
    const [incomingPayments, setIncomingPayments] = useState([]);
    const [outgoingPayments, setOutgoingPayments] = useState([]);
    const [checkoutId, setCheckoutId] = useState([]);
    const { id: paramId } = useParams();
    const API_BASE ="//localhost:3000" ;

    //used to get all incoming payments
    useEffect(() => {
        console.log("profileId is good:", paramId);
          
        const getIncoming = async () => {
            try {
                const payments = await getIncomingPay(profileId);
                setIncomingPayments(payments);
            }  catch (err) {
                console.error("Failed to get incomimg payments:", err.message);
            }
        }

        if (profileId) getIncoming();
    }, [profileId]);

    //used to get all outgoing payments
    useEffect(() => {
        const getOutgoing = async () => {
            try {
                const payments = await getOutgoingPay(profileId);
                setOutgoingPayments(payments);
            }  catch (err) {
                console.error("Failed to get outgoing payments:", err.message);
            }
        }

        if (profileId) getOutgoing();
    }, [profileId]);

    useEffect(() => {
        const fetchAndVerify = async () => {
          if (!profileId) return;
      
          try {
            const checkoutIds = await getCheckoutIds(profileId);
            console.log("Fetched checkout IDs:", checkoutIds);
            setCheckoutId(checkoutIds);
      
            if (checkoutIds.length > 0) {
              const res = await fetch(`${API_BASE}/stripe/verify-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ checkoutIds }),
              });
      
              const data = await res.json();
              data.results.forEach((payment) => {
                if (payment.status === "paid") {
                  updateStatus(payment.id);
                }
              });
            }
          } catch (err) {
            console.error("Error fetching or verifying payments:", err.message);
          }
        };
      
        fetchAndVerify();
      }, [profileId]);

    const handlePay = async (transaction) => {
        try {
            console.log("🧾 Transaction payload before fetch:", {
                seller_account: transaction.seller?.stripe_account_id,
                seller_username: transaction.seller?.username,
                amount: transaction.final_price,
                profileId: paramId,
              });
            //sends necessary info to backend to talk to stripe
            const res = await fetch(`${API_BASE}/stripe/create-checkout-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    seller_account: transaction.seller.stripe_account_id,
                    amount: transaction.final_price,
                    profileId: paramId,
                }),
            });
            // await response with stripe session Id
            console.log("📡 Status:", res.status);
            const data = await res.json();
            console.log("response data:", data);
            try {
            await updateSeshId(data.id, transaction.id);
            } catch (err) {
                console.error("failed :(", err.message);
            }

            window.open(data.url, "_blank");
        } catch (err) {
            console.error("Payment initiation failed:", err.message);
        }
    };

    return (
        <div className="table-container">
            <ToggleGroup
            options={[
                {icon: ArrowBigDownDash, value: "incoming"},
                {icon: ArrowBigUpDash, value: "outgoing"}
            ]}
            onChange={setView}
            />

            <div className="table-scroll-wrapper">
            {view === "incoming" ? (
                <PaymentsTable data={incomingPayments} type="incoming" />
            ) : (
                <PaymentsTable data={outgoingPayments} type="outgoing" onPay={handlePay} />
            )}
            </div>
        </div>
    );
}

const PaymentsTable = ({ data, type, onPay }) => (
    <table className="transaction-table">
        <thead>
            <tr>
                <th>Auctions</th>
                {type === "incoming" ? <th>Buyer</th> : <th>Seller</th>}
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th> </th>
            </tr>
        </thead>
        <tbody>
            {data?.length > 0 ? (
                data.map((tx) => (
                    <tr key={tx.id}>
                        <td>{tx.auctions?.title}</td>
                        <td>
                            {type === "incoming"
                            ? tx.buyer?.username
                            : tx.seller?.username}
                        </td>
                        <td>{formatCurrency(tx.final_price)}</td>
                        <td>{tx.paid ? "Paid ✅" : "Pending ⏳"}</td>
                        <td>{new Date(tx.created_at).toLocaleString()}</td>
                        {type === "outgoing" && (
                            <td>
                                <button
                                className="pay-btn"
                                disabled={tx.paid}
                                onClick={() => !tx.paid && onPay(tx)}
                                >
                                {tx.paid ? "Paid" : "Pay"}
                                </button>
                            </td>
                        )}
                    </tr>
                ))
            ) : (
                <tr>
                    <td colSpan="5" style={{ textAlign: "center" }}>
                        No Transactions found
                    </td>
                </tr>
            )}
        </tbody>
    </table>
);