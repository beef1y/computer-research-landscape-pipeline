##### stage **Q**

starting from **Q**, which is a question worth pursuing

**Q** is input by human and its value checked and evaluated by AI

the stage could be interactive until human confirmed a **Q** with a clear description and high research value (novelty, impact, and feasibility)



##### stage **G(Gamma)**

surround **Q**, derive multiple search queries to explore all possible related works, the set of related works is **G** or **Gamma**, which can be written as $\Gamma=\{g_1, g_2, \cdots, g_n\}$, then analyze and group $g_i$ by their methodologies into multiple directions $D_i$.  

$\Gamma = D_1 \cup D_2 \cup \cdots \cup D_k$

there could be slight overlap between these $D_i$, some $g_i$ might use multiple methodologies

the results should be verified and confirmed by human. there could be an interactive way for human to improve the search and enrich $\Gamma$.



##### stage **O(Omega)**

starting from the directional decomposition of $\Gamma$. let AI think about three questions:

(1) had each $D_i$ been sufficiently explored so the corresponding methodology has little potential to progress in solving **Q**, if not, what could be researched to improve along that methodological direction

(2) is there any unexplored combination of $D_i$  that could possibly improve the SOTA results of **Q**, by SOTA we mean better than all results in $\Gamma$

(3) is there any possibility to have a new direction $D_{k+1}$ to solve **Q**. the current results might not be SOTA but has potential to improve further and also enlighten the research community about new directions

After AI thoroughly consider these three questions, ask AI to propose a set of $\Delta$ which contains possible new ways to solve **Q** from the above three categories and also form the new total set $\Omega = \Gamma + \Delta$. 

ask AI to review $\Omega$ and do similar analysis as in stage **G**, decompose $\Omega$ into directions and evaluate to make sure all current possible new solutions had been considered, to the best knowledge and immediate thoughts of AI



##### stage **F(metric)**

starting from $\Gamma$ and $\Omega$, first analyze how many metrics had been proposed in the literatures in $\Gamma$, these are the existing metrics, then let AI ask the following questions:

(1) thinking for the total set $\Omega$, which contains more knowledge than $\Gamma$, are the existing metrics sufficient? do we need to introduce new metrics or improve existing metrics to better reflect the systematic knowledge we have now for the problem **Q**

(2) thinking for the difference set $\Delta = \Omega - \Gamma$, what are the proper metrics for each potential solution to be researched in $\Delta$, are what's our expected performance under each metric, what's the odds that the potential solution achieve SOTA performance under our selected or newly proposed metric?

with human confirmation on the selection of metric(s) for each potential research, evaluate their research success rate, cost, and impact (what tier of publication / influence it could lead to), rank these researches by effectiveness-to-cost ratio, form a recommendation list. draft research plans for the human confirmed selected research aiming the corresponding metric(s)



##### stage **X(optimization)**

 once the research is conducted and results are ready, let AI analyze and discuss if the achieved result is optimal, in the following senses:

(1) globally optimal for the problem **Q**

(2) optimal in the sense of all known methodologies as reveal in $\Gamma$

(3) optimal in the sense of methodology used in the current researh and the selected metric 

(4) cannot prove optimality, can only provide discussion on possible ways to achieve optimality

the discussion would be the chorus part of the paper, shows the depth of thinking of authors and differentiate seasoned researcher from green graduate students



